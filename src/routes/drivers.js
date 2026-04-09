const express = require('express');
const {
  getAvailableDeliveries,
  acceptDelivery,
  updateLocation,
  getDriverEarnings,
  getDriverActiveDelivery,
  getDriverOrders,
  updateDeliveryStatus
} = require('../controllers/driverController');
const {
  getProductStoreLocations,
  getNearbyStoreLocations,
  getStoresWithProductLocations,
  updateDriverCurrentLocation
} = require('../controllers/driverLocationController');
const { verifyToken, requireRole } = require('../middleware/authenticattion');

const router = express.Router();

// All driver routes require authentication
router.use(verifyToken);

// Driver management routes
router.get('/:driverId/available-deliveries', getAvailableDeliveries);
router.post('/:driverId/accept-delivery', acceptDelivery);
router.post('/:driverId/update-location', updateLocation);
router.get('/:driverId/earnings', getDriverEarnings);
router.get('/:driverId/active-delivery', getDriverActiveDelivery);
router.get('/:driverId/orders', getDriverOrders);
router.post('/:driverId/update-delivery-status', updateDeliveryStatus);

// Location-based routes (for driver store/product location queries)
router.get('/stores/nearby', requireRole('DRIVER'), getNearbyStoreLocations);
router.get('/products/:productId/stores', requireRole('DRIVER'), getProductStoreLocations);
router.post('/stores/products', requireRole('DRIVER'), getStoresWithProductLocations);
router.put('/location', requireRole('DRIVER'), updateDriverCurrentLocation);

module.exports = router;
