const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { User } = require('../entities/User');
const AppSetting = require('../entities/AppSetting');
const { Order } = require('../entities/Order');

// List users with optional role filter and pagination
const listUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20, q } = req.query;
  const repo = AppDataSource.getRepository(User);

  const qb = repo.createQueryBuilder('u');
  if (role) qb.andWhere('u.role = :role', { role });
  if (q) {
    qb.andWhere('(LOWER(u.name) LIKE :q OR LOWER(u.email) LIKE :q)', { q: `%${q.toLowerCase()}%` });
  }

  const p = parseInt(page);
  const l = Math.min(parseInt(limit), 100);
  qb.orderBy('u.createdAt', 'DESC').skip((p - 1) * l).take(l);

  const [users, total] = await qb.getManyAndCount();
  // remove sensitive fields
  const safe = users.map(({ passwordHash, otpCode, otpExpiry, ...rest }) => rest);
  res.json({ users: safe, pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) } });
});

// Update user status (e.g., ACTIVE, SUSPENDED)
const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, durationDays } = req.body; // expected: 'ACTIVE' | 'SUSPENDED' | 'PENDING'

  if (!['ACTIVE', 'SUSPENDED', 'PENDING'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id } });
  if (!user) return res.status(404).json({ message: 'User not found' });

  let suspendedUntil = null;
  if (status === 'SUSPENDED') {
    let days = parseInt(durationDays) || 60; // Default to 60 days
    const until = new Date();
    until.setDate(until.getDate() + days);
    suspendedUntil = until;
  }

  const update = { status };
  if (status === 'SUSPENDED') update.suspendedUntil = suspendedUntil;
  if (status === 'ACTIVE') update.suspendedUntil = null;

  await userRepo.update(id, update);
  const updated = await userRepo.findOne({ where: { id } });
  const { passwordHash, otpCode, otpExpiry, ...safe } = updated;
  res.json({ message: 'Status updated', user: safe });
});

// Settings: get and set default deactivation period
const getSettings = asyncHandler(async (req, res) => {
  const repo = AppDataSource.getRepository(AppSetting);
  const s = await repo.findOne({ where: { key: 'deactivationPeriodDays' } });
  res.json({ deactivationPeriodDays: parseInt(s?.value || '60') });
});

const setSettings = asyncHandler(async (req, res) => {
  const { deactivationPeriodDays } = req.body;
  const days = parseInt(deactivationPeriodDays);
  if (!days || isNaN(days) || days < 1 || days > 3650) {
    return res.status(400).json({ message: 'Invalid deactivationPeriodDays' });
  }
  const repo = AppDataSource.getRepository(AppSetting);
  const existing = await repo.findOne({ where: { key: 'deactivationPeriodDays' } });
  if (existing) {
    await repo.update('deactivationPeriodDays', { value: String(days) });
  } else {
    await repo.save({ key: 'deactivationPeriodDays', value: String(days) });
  }
  res.json({ message: 'Settings updated', deactivationPeriodDays: days });
});

// Get dashboard statistics
const getStats = asyncHandler(async (req, res) => {
  try {
    // Read optional days parameter (7 or 30, default 30)
    const rawDays = parseInt(req.query.days);
    const days = [7, 30].includes(rawDays) ? rawDays : 30;

    const { User } = require('../entities/User');
    const userRepo = AppDataSource.getRepository(User);

    // Get total users count
    const totalUsers = await userRepo.count();

    // Get active users count (status = ACTIVE)
    const activeUsers = await userRepo.count({ where: { status: 'ACTIVE' } });

    // Try to get orders and products, but don't fail if they don't exist
    let totalOrders = 0;
    let pendingOrders = 0;
    let totalRevenue = 0;
    let totalProducts = 0;

    try {
      const { Order } = require('../entities/Order');
      const orderRepo = AppDataSource.getRepository(Order);

      totalOrders = await orderRepo.count();
      pendingOrders = await orderRepo.count({ where: { status: 'PENDING' } });

      const revenueResult = await orderRepo
        .createQueryBuilder('order')
        .select('SUM(order.totalAmount)', 'total')
        .where('order.status != :status', { status: 'CANCELLED' })
        .getRawOne();

      totalRevenue = parseFloat(revenueResult?.total || 0);
    } catch (orderError) {
      console.log('Orders not available:', orderError.message);
    }

    try {
      const { Product } = require('../entities/Product');
      const productRepo = AppDataSource.getRepository(Product);
      totalProducts = await productRepo.count();
    } catch (productError) {
      console.log('Products not available:', productError.message);
    }

    // Get sales trend for the requested period
    let salesTrend = [];
    try {
      const { Order } = require('../entities/Order');
      const orderRepo = AppDataSource.getRepository(Order);

      const trendResult = await orderRepo
        .createQueryBuilder('order')
        .select("DATE_TRUNC('day', order.orderDate)", 'day')
        .addSelect('SUM(order.totalAmount)', 'revenue')
        .where('order.orderDate >= :date', { date: new Date(Date.now() - days * 24 * 60 * 60 * 1000) })
        .andWhere('order.status != :status', { status: 'CANCELLED' })
        .groupBy('day')
        .orderBy('day', 'ASC')
        .getRawMany();

      salesTrend = trendResult.map(t => ({
        day: t.day,
        revenue: parseFloat(t.revenue || 0)
      }));
    } catch (trendError) {
      console.log('Trend data failure:', trendError.message);
    }

    res.json({
      totalUsers,
      activeUsers,
      totalOrders,
      pendingOrders,
      totalRevenue,
      totalProducts,
      salesTrend
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ message: 'Failed to get statistics', error: error.message });
  }
});

// Get all orders (Admin only)
const getAllOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const orderRepo = AppDataSource.getRepository(Order);
  let query = orderRepo.createQueryBuilder('order')
    .leftJoinAndSelect('order.items', 'items')
    .leftJoinAndSelect('items.product', 'product')
    .leftJoinAndSelect('order.driver', 'driver')
    .leftJoinAndSelect('order.user', 'user');  // Add user relation

  if (status) {
    query = query.where('order.status = :status', { status });
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
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

module.exports = { listUsers, updateUserStatus, getSettings, setSettings, getStats, getAllOrders };
