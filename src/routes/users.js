const express = require('express');
const {
  getCurrentUser,
  updateCurrentUser,
  getUserById,
  getFavorites,
  addAddress,
  updateAddress,
  deleteAddress,
  addToFavorites,
  removeFromFavorites,
  updateLocation,
  registerPushToken,
  unregisterPushToken
} = require('../controllers/userController');
const { verifyToken, requireOwnershipOrAdmin } = require('../middleware/authenticattion');

const router = express.Router();

// User profile routes
router.get('/me', verifyToken, getCurrentUser);
router.get('/me/favorites', verifyToken, getFavorites);
router.put('/me', verifyToken, updateCurrentUser);
router.get('/:id', verifyToken, getUserById);

// Address management
router.post('/me/addresses', verifyToken, addAddress);
router.put('/me/addresses/:addressId', verifyToken, updateAddress);
router.delete('/me/addresses/:addressId', verifyToken, deleteAddress);

// Favorites management
router.post('/me/favorites', verifyToken, addToFavorites);
router.delete('/me/favorites/:productId', verifyToken, removeFromFavorites);

// Location management
router.post('/me/location', verifyToken, updateLocation);

// Push notification token management
router.post('/me/push-token', verifyToken, registerPushToken);
router.delete('/me/push-token', verifyToken, unregisterPushToken);

module.exports = router;
