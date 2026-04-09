const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { Order } = require('../entities/Order');
const { OrderItem } = require('../entities/OrderItem');
const { Cart } = require('../entities/Cart');
const { Product } = require('../entities/Product');
const { Address } = require('../entities/Address');
const { DriverTrip } = require('../entities/DriverTrip');
const { User } = require('../entities/User');

// Create order from cart
const createOrder = asyncHandler(async (req, res) => {
  const { deliveryAddressId, paymentMethod, tip = 0, items, totalAmount } = req.body;

  if (!deliveryAddressId || !paymentMethod) {
    return res.status(400).json({
      message: 'deliveryAddressId and paymentMethod are required'
    });
  }

  console.log('[Order] Request body:', req.body);
  console.log('[Order] Items received:', items, 'Length:', items ? items.length : 'undefined');
  console.log('[Order] Total amount received:', totalAmount);

  if (!items || !Array.isArray(items) || items.length === 0) {
    console.log('[Order] Rejecting: Invalid or empty items');
    return res.status(400).json({
      message: 'Cart items are required and cannot be empty'
    });
  }

  if (!totalAmount || totalAmount <= 0) {
    console.log('[Order] Rejecting: Invalid total amount');
    return res.status(400).json({
      message: 'Total amount must be greater than 0'
    });
  }

  console.log('[Order] Creating order for user', req.user.id, 'Items from frontend:', items.length);

  // Verify delivery address
  const addressRepo = AppDataSource.getRepository(Address);
  const deliveryAddress = await addressRepo.findOne({
    where: { id: deliveryAddressId, userId: req.user.id }
  });

  if (!deliveryAddress) {
    return res.status(400).json({ message: 'Invalid delivery address' });
  }

  // Start transaction
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Get repositories
    const productRepo = queryRunner.manager.getRepository(Product);
    const orderRepo = queryRunner.manager.getRepository(Order);
    const orderItemRepo = queryRunner.manager.getRepository(OrderItem);

    // Validate products exist (no stock checking)
    const validItems = [];

    for (const item of items) {
      const product = await productRepo.findOne({ where: { id: item.productId } });
      if (product && item.quantity > 0) {
        validItems.push(item);
      }
    }

    if (validItems.length === 0) {
      return res.status(400).json({
        message: 'No valid items found in cart'
      });
    }

    console.log('[Order] Valid items:', validItems.length);

    // Get first product's owner (supermarket) to determine pickup location
    const firstProduct = await productRepo.findOne({
      where: { id: validItems[0].productId }
    });

    let storeLat = null;
    let storeLon = null;
    let storeId = null;

    if (firstProduct && firstProduct.ownerId) {
      const userRepo = queryRunner.manager.getRepository(User);
      const storeOwner = await userRepo.findOne({
        where: { id: firstProduct.ownerId, role: 'SUPERMARKET' }
      });

      if (storeOwner) {
        storeLat = storeOwner.latitude;
        storeLon = storeOwner.longitude;
        storeId = storeOwner.id;
      }
    }

    // Create order - auto-confirm so it appears in driver available deliveries
    const order = orderRepo.create({
      userId: req.user.id,
      totalAmount: totalAmount,
      status: 'CONFIRMED', // Auto-confirm so drivers can see it immediately
      paymentMethod,
      tip,
      storeLat,
      storeLon,
      storeId,
      destLat: deliveryAddress.latitude,
      destLon: deliveryAddress.longitude,
      deliveryAddress: {
        title: deliveryAddress.title,
        street: deliveryAddress.street,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        zipCode: deliveryAddress.zipCode,
        country: deliveryAddress.country,
        deliveryInstructions: deliveryAddress.deliveryInstructions
      },
      trackingNumber: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    });

    const savedOrder = await orderRepo.save(order);

    // Create order items (no stock updates)
    for (const item of validItems) {
      const orderItem = orderItemRepo.create({
        orderId: savedOrder.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        selectedOptions: item.selectedOptions
      });

      await orderItemRepo.save(orderItem);
    }

    await queryRunner.commitTransaction();

    // Get complete order with items
    const completeOrder = await orderRepo.findOne({
      where: { id: savedOrder.id },
      relations: ['items', 'items.product']
    });

    // Broadcast new order to supermarkets
    if (req.wsService) {
      req.wsService.broadcastNewOrder({
        orderId: completeOrder.id,
        userId: completeOrder.userId,
        totalAmount: completeOrder.totalAmount,
        items: completeOrder.items,
        deliveryAddress: completeOrder.deliveryAddress
      });
    }

    res.status(201).json(completeOrder);

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
});

// Get orders for current user
const getOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const orderRepo = AppDataSource.getRepository(Order);
  let query = orderRepo.createQueryBuilder('order')
    .leftJoinAndSelect('order.items', 'items')
    .leftJoinAndSelect('items.product', 'product')
    .where('order.userId = :userId', { userId: req.user.id });

  if (status) {
    query = query.andWhere('order.status = :status', { status });
  }

  query = query.orderBy('order.createdAt', 'DESC');

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  query = query.skip(skip).take(parseInt(limit));

  const [orders, total] = await query.getManyAndCount();

  res.json({
    orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  });
});

// Get orders for the authenticated store
const getStoreOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const orderRepo = AppDataSource.getRepository(Order);
  let query = orderRepo.createQueryBuilder('order')
    .leftJoinAndSelect('order.items', 'items')
    .leftJoinAndSelect('items.product', 'product')
    .where('product.ownerId = :ownerId', { ownerId: req.user.id });

  if (status) {
    query = query.andWhere('order.status = :status', { status });
  }

  query = query.orderBy('order.createdAt', 'DESC');

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  query = query.skip(skip).take(parseInt(limit));

  const [orders, total] = await query.getManyAndCount();

  res.json({
    orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  });
});

// Get order by ID
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const orderRepo = AppDataSource.getRepository(Order);
  const order = await orderRepo.findOne({
    where: { id },
    relations: ['items', 'items.product', 'driver']
  });

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Check if user has access to this order
  if (order.userId !== req.user.id &&
    req.user.role !== 'SUPERMARKET' &&
    req.user.role !== 'DRIVER' &&
    req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }

  res.json(order);
});

// Update order status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  const validStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const orderRepo = AppDataSource.getRepository(Order);
  const order = await orderRepo.findOne({
    where: { id },
    relations: ['driver']
  });

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Check permissions based on role and status transition
  const canUpdate = checkStatusUpdatePermission(req.user, order, status);
  if (!canUpdate) {
    return res.status(403).json({ message: 'Not authorized to update order status' });
  }

  const updates = { status };

  // Set delivery date when order is delivered
  if (status === 'DELIVERED') {
    updates.deliveryDate = new Date();
  }

  await orderRepo.update(id, updates);
  const updatedOrder = await orderRepo.findOne({
    where: { id },
    relations: ['items', 'items.product', 'driver']
  });

  // Broadcast order status update
  if (req.wsService) {
    req.wsService.broadcastOrderUpdate(id, {
      status,
      driver: updatedOrder.driver ? {
        id: updatedOrder.driver.id,
        name: updatedOrder.driver.name,
        lat: updatedOrder.driverLat,
        lon: updatedOrder.driverLon
      } : null
    });
  }

  res.json(updatedOrder);
});

// Assign driver to order
const assignDriver = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { driverId } = req.body;

  if (!driverId) {
    return res.status(400).json({ message: 'Driver ID is required' });
  }

  const orderRepo = AppDataSource.getRepository(Order);
  const driverTripRepo = AppDataSource.getRepository(DriverTrip);

  const order = await orderRepo.findOne({ where: { id } });
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Check if driver exists and has DRIVER role
  const userRepo = AppDataSource.getRepository('User');
  const driver = await userRepo.findOne({ where: { id: driverId, role: 'DRIVER' } });
  if (!driver) {
    return res.status(400).json({ message: 'Invalid driver' });
  }

  // Assign driver to order
  await orderRepo.update(id, { driverId });

  // Create or update driver trip
  let driverTrip = await driverTripRepo.findOne({ where: { orderId: id } });
  if (!driverTrip) {
    driverTrip = driverTripRepo.create({
      orderId: id,
      driverId,
      status: 'ASSIGNED'
    });
  } else {
    driverTrip.driverId = driverId;
    driverTrip.status = 'ASSIGNED';
  }

  await driverTripRepo.save(driverTrip);

  const updatedOrder = await orderRepo.findOne({
    where: { id },
    relations: ['driver']
  });

  res.json(updatedOrder);
});

// Share location (Driver only)
const shareLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { lat, lon, eta } = req.body;

  if (!lat || !lon) {
    return res.status(400).json({ message: 'Latitude and longitude are required' });
  }

  const orderRepo = AppDataSource.getRepository(Order);
  const driverTripRepo = AppDataSource.getRepository(DriverTrip);

  const order = await orderRepo.findOne({
    where: { id, driverId: req.user.id }
  });

  if (!order) {
    return res.status(404).json({ message: 'Order not found or not assigned to you' });
  }

  // Update order with driver location
  await orderRepo.update(id, {
    driverLat: lat,
    driverLon: lon
  });

  // Update driver trip
  const driverTrip = await driverTripRepo.findOne({ where: { orderId: id } });
  if (driverTrip) {
    await driverTripRepo.update(driverTrip.id, {
      lastLat: lat,
      lastLon: lon,
      eta: eta
    });
  }

  // Broadcast driver location update
  if (req.wsService) {
    req.wsService.broadcastDriverLocation(id, {
      driverId: req.user.id,
      lat,
      lon,
      eta
    });
  }

  res.json({ message: 'Location updated successfully' });
});

// Share customer location (Customer only)
const shareCustomerLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ message: 'Latitude and longitude are required' });
  }

  const orderRepo = AppDataSource.getRepository(Order);

  const order = await orderRepo.findOne({
    where: { id, userId: req.user.id }
  });

  if (!order) {
    return res.status(404).json({ message: 'Order not found or not yours' });
  }

  // Update order with customer's current location
  await orderRepo.update(id, {
    destLat: latitude,
    destLon: longitude
  });

  // Broadcast customer location update to driver
  if (req.wsService) {
    req.wsService.broadcastCustomerLocation(id, {
      latitude,
      longitude
    });
  }

  res.json({ message: 'Customer location updated successfully' });
});

const cancelOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const orderRepo = AppDataSource.getRepository(Order);
  const order = await orderRepo.findOne({
    where: { id },
    relations: ['items']
  });

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Check if user can cancel this order
  const canCancel = order.userId === req.user.id ||
    req.user.role === 'SUPERMARKET' ||
    req.user.role === 'ADMIN';

  if (!canCancel) {
    return res.status(403).json({ message: 'Not authorized to cancel this order' });
  }

  // Check if order can be cancelled
  if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
    return res.status(400).json({ message: 'Order cannot be cancelled' });
  }

  // Start transaction to restore stock
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Restore product stock
    const productRepo = queryRunner.manager.getRepository(Product);

    for (const item of order.items) {
      const product = await productRepo.findOne({ where: { id: item.productId } });
      if (product) {
        const newStockCount = product.stockCount + item.quantity;
        await productRepo.update(item.productId, {
          stockCount: newStockCount,
          inStock: newStockCount > 0
        });
      }
    }

    // Update order status
    await queryRunner.manager.update(Order, id, { status: 'CANCELLED' });

    await queryRunner.commitTransaction();

    const updatedOrder = await orderRepo.findOne({ where: { id } });
    res.json(updatedOrder);

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
});

// Helper function to check status update permissions
function checkStatusUpdatePermission(user, order, newStatus) {
  // Admin can update any status
  if (user.role === 'ADMIN') return true;

  // Customer can only cancel their own orders
  if (user.role === 'CUSTOMER' && user.id === order.userId && newStatus === 'CANCELLED') {
    return ['PENDING', 'CONFIRMED'].includes(order.status);
  }

  // Supermarket can update status from PENDING to DELIVERED
  if (user.role === 'SUPERMARKET') {
    return ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].includes(newStatus);
  }

  if (user.role === 'DRIVER' && order.driverId === user.id) {
    return ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(newStatus);
  }

  return false;
}

module.exports = {
  createOrder,
  getOrders,
  getStoreOrders,
  getOrderById,
  updateOrderStatus,
  assignDriver,
  shareLocation,
  shareCustomerLocation,
  cancelOrder
};
