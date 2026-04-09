const express = require('express');
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  assignDriver,
  shareLocation,
  shareCustomerLocation,
  cancelOrder
} = require('../controllers/orderController');
const { verifyToken, requireRole } = require('../middleware/authenticattion');

const router = express.Router();

// All order routes require authentication
router.use(verifyToken);

// Order management routes
router.post('/', requireRole('CUSTOMER'), createOrder);
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.put('/:id/status', updateOrderStatus);
router.post('/:id/assign-driver', requireRole('SUPERMARKET', 'ADMIN'), assignDriver);
router.post('/:id/share-location', requireRole('DRIVER'), shareLocation);
router.post('/:id/share-customer-location', requireRole('CUSTOMER'), shareCustomerLocation);
router.post('/:id/cancel', cancelOrder);

module.exports = router;

