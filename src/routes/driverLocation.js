const express = require('express');
const { 
  getProductStores,
  getNearbyStores,
  getStoresWithProducts,
  updateDriverLocation
} = require('../controllers/driverLocationController');
const { verifyToken, requireRole } = require('../middleware/authenticattion');

const router = express.Router();

// All driver routes require authentication and DRIVER role
router.use(verifyToken);
router.use(requireRole('DRIVER'));

// Driver location-based routes
router.get('/stores/nearby', getNearbyStores);
router.get('/products/:productId/stores', getProductStores);
router.post('/stores/products', getStoresWithProducts);
router.put('/location', updateDriverLocation);

module.exports = router;
