const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { User } = require('../entities/User');
const { getStoreLocationsForProduct, getNearbyStores, getStoresWithProducts } = require('../services/driverLocationService');

/**
 * Get store locations for a specific product
 * Drivers use this to see where they need to deliver products
 */
const getProductStoreLocations = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { latitude, longitude, maxDistance = 50 } = req.query;
  
  if (!productId) {
    return res.status(400).json({ message: 'Product ID is required' });
  }
  
  // Parse coordinates if provided
  let driverLatitude = null;
  let driverLongitude = null;
  
  if (latitude && longitude) {
    driverLatitude = parseFloat(latitude);
    driverLongitude = parseFloat(longitude);
    
    if (isNaN(driverLatitude) || isNaN(driverLongitude)) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }
  }
  
  const result = await getStoreLocationsForProduct(
    productId, 
    driverLatitude, 
    driverLongitude, 
    parseFloat(maxDistance)
  );
  
  res.json(result);
});

/**
 * Get all nearby stores for a driver
 * Useful for drivers to see available delivery locations
 */
const getNearbyStoreLocations = asyncHandler(async (req, res) => {
  const { latitude, longitude, maxDistance = 50, limit = 20 } = req.query;
  
  if (!latitude || !longitude) {
    return res.status(400).json({ message: 'Driver location (latitude, longitude) is required' });
  }
  
  const driverLatitude = parseFloat(latitude);
  const driverLongitude = parseFloat(longitude);
  const maxDistanceKm = parseFloat(maxDistance);
  const storeLimit = parseInt(limit);
  
  if (isNaN(driverLatitude) || isNaN(driverLongitude) || isNaN(maxDistanceKm) || isNaN(storeLimit)) {
    return res.status(400).json({ message: 'Invalid parameters' });
  }
  
  const result = await getNearbyStores(
    driverLatitude, 
    driverLongitude, 
    maxDistanceKm, 
    storeLimit
  );
  
  res.json(result);
});

/**
 * Get stores that have specific products
 * For drivers looking for delivery opportunities with specific items
 */
const getStoresWithProductLocations = asyncHandler(async (req, res) => {
  const { productIds, latitude, longitude, maxDistance = 50 } = req.body;
  
  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ message: 'Product IDs array is required' });
  }
  
  // Parse coordinates if provided
  let driverLatitude = null;
  let driverLongitude = null;
  
  if (latitude && longitude) {
    driverLatitude = parseFloat(latitude);
    driverLongitude = parseFloat(longitude);
    
    if (isNaN(driverLatitude) || isNaN(driverLongitude)) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }
  }
  
  const result = await getStoresWithProducts(
    productIds,
    driverLatitude,
    driverLongitude,
    parseFloat(maxDistance)
  );
  
  res.json(result);
});

/**
 * Update driver location (for tracking)
 */
const updateDriverCurrentLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;
  const driverId = req.user.id;
  
  if (!latitude || !longitude) {
    return res.status(400).json({ message: 'Latitude and longitude are required' });
  }
  
  const driverLatitude = parseFloat(latitude);
  const driverLongitude = parseFloat(longitude);
  
  if (isNaN(driverLatitude) || isNaN(driverLongitude)) {
    return res.status(400).json({ message: 'Invalid coordinates' });
  }
  
  if (driverLatitude < -90 || driverLatitude > 90 || driverLongitude < -180 || driverLongitude > 180) {
    return res.status(400).json({ message: 'Coordinates out of valid range' });
  }
  
  const userRepo = AppDataSource.getRepository(User);
  
  // Update driver's location
  await userRepo.update(driverId, {
    latitude: driverLatitude,
    longitude: driverLongitude,
    updatedAt: new Date()
  });
  
  // Get updated driver info
  const updatedDriver = await userRepo.findOne({ 
    where: { id: driverId },
    select: ['id', 'name', 'email', 'latitude', 'longitude', 'updatedAt']
  });
  
  res.json({
    message: 'Location updated successfully',
    driver: updatedDriver
  });
});

module.exports = {
  getProductStoreLocations,
  getNearbyStoreLocations,
  getStoresWithProductLocations,
  updateDriverCurrentLocation
};
