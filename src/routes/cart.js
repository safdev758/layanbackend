const express = require('express');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
} = require('../controllers/cartController');
const { verifyToken } = require('../middleware/authenticattion');

const router = express.Router();

// All cart routes require authentication
router.use(verifyToken);

// Cart management routes
router.get('/', getCart);
router.post('/items', addToCart);
router.put('/items/:productId', updateCartItem);
router.delete('/items/:productId', removeFromCart);
router.post('/clear', clearCart);

module.exports = router;
