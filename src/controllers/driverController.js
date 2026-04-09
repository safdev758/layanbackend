const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { Order } = require('../entities/Order');
const { DriverTrip } = require('../entities/DriverTrip');
const { User } = require('../entities/User');
const { Between, In } = require('typeorm');
const {
  ACTIVE_ORDER_STATUSES,
  getHangingOrderCutoff,
  maintainDriverOrders
} = require('../services/driverOrderMaintenanceService');

// Get available deliveries for driver
const getAvailableDeliveries = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { lat, lng, radius_km = 10 } = req.query;

  // Verify driver exists and is authenticated
  if (req.user.id !== driverId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const orderRepo = AppDataSource.getRepository(Order);

  // Calculate cutoff time (30 minutes ago)
  const thirtyMinutesAgo = getHangingOrderCutoff();

  // If location provided, use geospatial query with Haversine formula
  if (lat && lng) {
    const driverLat = parseFloat(lat);
    const driverLng = parseFloat(lng);
    const radiusKm = parseFloat(radius_km);

    // Haversine formula in SQL to calculate distance
    const availableOrders = await orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.status = :status', { status: 'CONFIRMED' })
      .andWhere('order.driverId IS NULL')
      .andWhere('order.createdAt > :cutoff', { cutoff: thirtyMinutesAgo })
      .andWhere('order.storeLat IS NOT NULL')
      .andWhere('order.storeLon IS NOT NULL')
      .andWhere(
        `(
          6371 * acos(
            cos(radians(:driverLat)) * 
            cos(radians(order.storeLat)) * 
            cos(radians(order.storeLon) - radians(:driverLng)) + 
            sin(radians(:driverLat)) * 
            sin(radians(order.storeLat))
          )
        ) <= :radiusKm`,
        { driverLat, driverLng, radiusKm }
      )
      .orderBy('order.createdAt', 'ASC')
      .getMany();

    res.json(availableOrders);
  } else {
    // Fallback to all available orders if no location provided (still filter by time)
    const availableOrders = await orderRepo.find({
      where: {
        status: 'CONFIRMED',
        driverId: null
      },
      relations: ['user', 'items', 'items.product'],
      order: { createdAt: 'ASC' }
    });

    // Filter orders created within last 30 minutes
    const recentOrders = availableOrders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate > thirtyMinutesAgo;
    });

    res.json(recentOrders);
  }
});

// Accept delivery
const acceptDelivery = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: 'Order ID is required' });
  }

  // Verify driver exists and is authenticated
  if (req.user.id !== driverId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const orderRepo = AppDataSource.getRepository(Order);
  const driverTripRepo = AppDataSource.getRepository(DriverTrip);
  const userRepo = AppDataSource.getRepository(User);

  // Start transaction
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Check if order is available (with lock to prevent race conditions)
    const order = await queryRunner.manager.findOne(Order, {
      where: { id: orderId, status: 'CONFIRMED', driverId: null },
      relations: ['user']
    });

    if (!order) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      return res.status(400).json({ message: 'Order not available for pickup' });
    }

    // Get driver information
    const driver = await queryRunner.manager.findOne(User, {
      where: { id: driverId }
    });

    if (!driver) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Assign driver to order
    await queryRunner.manager.update(Order, orderId, {
      driverId,
      status: 'PREPARING'
    });

    // Create or update driver trip
    let driverTrip = await queryRunner.manager.findOne(DriverTrip, {
      where: { orderId }
    });

    if (!driverTrip) {
      driverTrip = queryRunner.manager.create(DriverTrip, {
        orderId,
        driverId,
        status: 'ACCEPTED',
        acceptedAt: new Date()
      });
    } else {
      driverTrip.driverId = driverId;
      driverTrip.status = 'ACCEPTED';
      driverTrip.acceptedAt = new Date();
    }

    await queryRunner.manager.save(DriverTrip, driverTrip);
    await queryRunner.commitTransaction();

    // Get updated order with all relations
    const updatedOrder = await orderRepo.findOne({
      where: { id: orderId },
      relations: ['user', 'items', 'items.product']
    });

    // Send WebSocket notifications
    if (req.wsService) {
      // Notify the customer that driver accepted the order
      req.wsService.sendNotificationToUser(order.userId, {
        type: 'order:driver_assigned',
        orderId,
        driverId,
        driverName: driver.name,
        message: `Driver ${driver.name} has accepted your order`,
        status: 'PREPARING'
      });

      // Notify all drivers that this order is no longer available
      req.wsService.sendNotificationToRole('DRIVER', {
        type: 'delivery:accepted',
        orderId,
        driverId,
        message: 'Order has been accepted by another driver'
      });

      // Broadcast order status update
      req.wsService.broadcastOrderUpdate(orderId, {
        status: 'PREPARING',
        driverId,
        driverName: driver.name
      });
    }

    res.json(updatedOrder);

  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Error accepting delivery:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
});

// Update driver location
const updateLocation = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { orderId, lat, lon, timestamp } = req.body;

  if (!lat || !lon) {
    return res.status(400).json({ message: 'Latitude and longitude are required' });
  }

  // Verify driver exists and is authenticated
  if (req.user.id !== driverId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const orderRepo = AppDataSource.getRepository(Order);
  const driverTripRepo = AppDataSource.getRepository(DriverTrip);

  // Update order location
  if (orderId) {
    const order = await orderRepo.findOne({
      where: { id: orderId, driverId }
    });

    if (order) {
      await orderRepo.update(orderId, {
        driverLat: lat,
        driverLon: lon
      });

      // Update driver trip
      const driverTrip = await driverTripRepo.findOne({
        where: { orderId, driverId }
      });

      if (driverTrip) {
        await driverTripRepo.update(driverTrip.id, {
          lastLat: lat,
          lastLon: lon
        });
      }

      // Broadcast driver location to customers tracking this order
      if (req.wsService) {
        req.wsService.broadcastDriverLocation(orderId, {
          driverId,
          latitude: lat,
          longitude: lon
        });
      }
    }
  }

  res.json({ message: 'Location updated successfully' });
});

// Get driver earnings
const getDriverEarnings = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { period = 'month', from, to } = req.query;

  // Verify driver exists and is authenticated
  if (req.user.id !== driverId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const driverTripRepo = AppDataSource.getRepository(DriverTrip);
  const orderRepo = AppDataSource.getRepository(Order);

  // Calculate date range based on period or query params
  let startDate, endDate;
  const now = new Date();
  if (from && to) {
    startDate = new Date(from);
    endDate = new Date(to);
  } else {
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    endDate = now;
  }

  // Get completed trips in period
  const completedTrips = await driverTripRepo.find({
    where: {
      driverId,
      status: 'DELIVERED',
      deliveredAt: Between(startDate, endDate)
    },
    relations: ['order']
  });

  // Calculate earnings - Fixed 200 DA per delivery
  const DRIVER_TIP_PER_DELIVERY = 200;
  const totalTrips = completedTrips.length;
  const totalEarnings = totalTrips * DRIVER_TIP_PER_DELIVERY;

  // Map earnings details
  const earningsDetails = completedTrips.map(trip => ({
    orderId: trip.orderId,
    amount: DRIVER_TIP_PER_DELIVERY,
    date: trip.deliveredAt.toISOString(),
    status: trip.status
  }));

  // Respond with the format matching the Kotlin data class
  res.json({
    driverId: driverId,
    totalEarnings: totalEarnings,
    completedTrips: totalTrips,
    pendingEarnings: 0, // Placeholder for pending earnings logic
    period: period,
    earnings: earningsDetails
  });
});

// Get driver's current orders
const getDriverOrders = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { status, activeOnly, page = 1, limit = 20 } = req.query;

  // Verify driver exists and is authenticated
  if (req.user.id !== driverId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const orderRepo = AppDataSource.getRepository(Order);
  const parsedPage = Math.max(parseInt(String(page), 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
  const shouldReturnActiveOnly = String(activeOnly).toLowerCase() === 'true';

  if (shouldReturnActiveOnly) {
    const activeOrders = await orderRepo.find({
      where: { driverId, status: In(ACTIVE_ORDER_STATUSES) },
      relations: ['user'],
      order: { updatedAt: 'DESC' },
      take: 1
    });
    return res.json(activeOrders);
  }

  const query = orderRepo
    .createQueryBuilder('order')
    .leftJoinAndSelect('order.user', 'user')
    .leftJoinAndSelect('order.items', 'items')
    .leftJoinAndSelect('items.product', 'product')
    .where('order.driverId = :driverId', { driverId });

  if (status) {
    query.andWhere('order.status = :status', { status });
  }

  const orders = await query
    .orderBy('order.createdAt', 'DESC')
    .skip((parsedPage - 1) * parsedLimit)
    .take(parsedLimit)
    .getMany();

  return res.json(orders);
});

// Get driver's single active delivery quickly (backend source of truth)
const getDriverActiveDelivery = asyncHandler(async (req, res) => {
  const { driverId } = req.params;

  if (req.user.id !== driverId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const orderRepo = AppDataSource.getRepository(Order);

  // Keep this driver's state fresh without scanning full history.
  await maintainDriverOrders({ driverId, batchSize: 100 });

  const activeOrder = await orderRepo.findOne({
    where: { driverId, status: In(ACTIVE_ORDER_STATUSES) },
    relations: ['user'],
    order: { updatedAt: 'DESC' }
  });

  return res.json(activeOrder || null);
});

// Update delivery status (pick up, deliver, etc.)
const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const { driverId } = req.params;
  const { orderId, status } = req.body;

  if (!orderId || !status) {
    return res.status(400).json({ message: 'Order ID and status are required' });
  }

  // Verify driver exists and is authenticated
  if (req.user.id !== driverId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const validStatuses = ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const orderRepo = AppDataSource.getRepository(Order);

  // Start transaction
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const order = await queryRunner.manager
      .createQueryBuilder(Order, 'order')
      .where('order.id = :orderId', { orderId })
      .andWhere('order.driverId = :driverId', { driverId })
      .setLock('pessimistic_write')
      .getOne();

    if (!order) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({ message: 'Order not found or not assigned to you' });
    }

    if (order.status === 'DELIVERED') {
      await queryRunner.rollbackTransaction();
      return res.status(409).json({ message: 'Order already delivered' });
    }

    if (order.status === 'CANCELLED') {
      await queryRunner.rollbackTransaction();
      return res.status(409).json({ message: 'Cannot update a cancelled order' });
    }

    let driverTrip = await queryRunner.manager.findOne(DriverTrip, {
      where: { orderId, driverId }
    });

    if (driverTrip && driverTrip.status === 'DELIVERED') {
      await queryRunner.manager.update(Order, orderId, {
        status: 'DELIVERED',
        deliveryDate: order.deliveryDate || new Date()
      });
      await queryRunner.commitTransaction();
      return res.status(409).json({ message: 'Order already delivered' });
    }

    const staleCutoff = getHangingOrderCutoff();
    if (
      ACTIVE_ORDER_STATUSES.includes(order.status) &&
      new Date(order.updatedAt) <= staleCutoff
    ) {
      await queryRunner.manager.update(Order, orderId, { status: 'CANCELLED' });

      if (driverTrip && driverTrip.status !== 'DELIVERED') {
        await queryRunner.manager.update(DriverTrip, driverTrip.id, { status: 'CANCELLED' });
      }

      await queryRunner.commitTransaction();
      return res
        .status(409)
        .json({ message: 'Order expired after 30 minutes and was cancelled' });
    }

    // Update order status
    let orderStatus = order.status;
    switch (status) {
      case 'PICKED_UP':
      case 'IN_TRANSIT':
        orderStatus = 'OUT_FOR_DELIVERY';
        break;
      case 'DELIVERED':
        orderStatus = 'DELIVERED';
        break;
    }

    const orderUpdates = { status: orderStatus };
    if (orderStatus === 'DELIVERED') {
      orderUpdates.deliveryDate = new Date();
    }
    await queryRunner.manager.update(Order, orderId, orderUpdates);

    // Update driver trip
    if (driverTrip) {
      const tripUpdates = { status };

      if (status === 'PICKED_UP') {
        tripUpdates.pickedUpAt = new Date();
      } else if (status === 'DELIVERED') {
        tripUpdates.deliveredAt = new Date();
      }

      await queryRunner.manager.update(DriverTrip, driverTrip.id, tripUpdates);
    }

    await queryRunner.commitTransaction();

    const updatedOrder = await orderRepo.findOne({
      where: { id: orderId },
      relations: ['user']
    });

    res.json(updatedOrder);

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
});

module.exports = {
  getAvailableDeliveries,
  acceptDelivery,
  updateLocation,
  getDriverEarnings,
  getDriverActiveDelivery,
  getDriverOrders,
  updateDeliveryStatus
};
