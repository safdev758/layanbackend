const { AppDataSource } = require('../config/data-source');
const { Product } = require('../entities/Product');
const { User } = require('../entities/User');
const { calculateDistance } = require('./locationVerificationService');
const { Not, IsNull } = require('typeorm');

/**
 * Get store locations for a specific product
 * For Global Products: Returns all stores that have this product
 * For Personal Products: Returns only the supermarket that owns this product
 */
async function getStoreLocationsForProduct(productId, driverLatitude = null, driverLongitude = null, maxDistanceKm = 50) {
  const productRepo = AppDataSource.getRepository(Product);
  const userRepo = AppDataSource.getRepository(User);

  // Find the product
  const product = await productRepo.findOne({
    where: { id: productId },
    relations: ['owner']
  });

  if (!product) {
    throw new Error('Product not found');
  }

  let stores = [];

  if (product.isGlobal) {
    // For Global Products, find all stores that have this product as an instance
    const storeProducts = await productRepo.find({
      where: {
        globalProductId: productId,
        isGlobal: false,
        isActive: true
      },
      relations: ['owner']
    });

    // Get unique store owners
    const storeOwnerIds = [...new Set(storeProducts.map(p => p.ownerId))];

    stores = await userRepo.find({
      where: {
        id: storeOwnerIds,
        role: 'SUPERMARKET',
        status: 'ACTIVE',
        locationVerified: true,
        latitude: Not(IsNull()),
        longitude: Not(IsNull())
      },
      select: ['id', 'name', 'email', 'latitude', 'longitude', 'phone']
    });

  } else {
    // For Personal Products, return only the owner supermarket
    if (product.owner.role === 'SUPERMARKET' &&
      product.owner.status === 'ACTIVE' &&
      product.owner.locationVerified &&
      product.owner.latitude &&
      product.owner.longitude) {

      stores = [{
        id: product.owner.id,
        name: product.owner.name,
        email: product.owner.email,
        latitude: product.owner.latitude,
        longitude: product.owner.longitude,
        phone: product.owner.phone
      }];
    }
  }

  // Filter by distance if driver location is provided
  if (driverLatitude && driverLongitude && stores.length > 0) {
    stores = stores.filter(store => {
      const distance = calculateDistance(
        driverLatitude, driverLongitude,
        store.latitude, store.longitude
      );
      return distance <= maxDistanceKm;
    });

    // Add distance to each store
    stores = stores.map(store => ({
      ...store,
      distance: calculateDistance(
        driverLatitude, driverLongitude,
        store.latitude, store.longitude
      )
    }));

    // Sort by distance (closest first)
    stores.sort((a, b) => a.distance - b.distance);
  }

  return {
    productId,
    productType: product.isGlobal ? 'GLOBAL' : 'PERSONAL',
    productName: product.name,
    stores,
    totalStores: stores.length
  };
}

/**
 * Get all nearby stores for a driver
 */
async function getNearbyStores(driverLatitude, driverLongitude, maxDistanceKm = 50, limit = 20) {
  const userRepo = AppDataSource.getRepository(User);
  console.log(`getNearbyStores called with: lat=${driverLatitude}, lon=${driverLongitude}, maxDistance=${maxDistanceKm}`);

  // Find all active supermarkets with verified locations
  // Join with addresses to get the primary address
  const stores = await userRepo.find({
    where: {
      role: 'SUPERMARKET',
      status: 'ACTIVE',
      locationVerified: true,
      latitude: Not(IsNull()),
      longitude: Not(IsNull())
    },
    relations: ['addresses'],
    select: ['id', 'name', 'email', 'latitude', 'longitude', 'phone', 'locationVerified']
  });

  console.log(`Found ${stores.length} supermarkets in DB matching criteria (ACTIVE, SUPERMARKET, verified, lat/lon not null)`);

  // Filter by distance and add distance info
  let nearbyStores = stores
    .map(store => {
      const primaryAddress = store.addresses ? (store.addresses.find(a => a.isDefault) || store.addresses[0]) : null;
      const addressString = primaryAddress
        ? `${primaryAddress.street}, ${primaryAddress.city}`
        : "Verified Store";

      const distance = calculateDistance(
        driverLatitude, driverLongitude,
        store.latitude, store.longitude
      );

      return {
        id: store.id,
        name: store.name,
        email: store.email,
        latitude: store.latitude,
        longitude: store.longitude,
        phone: store.phone,
        address: addressString,
        distance: distance
      };
    })
    .filter(store => {
      const isNearby = store.distance <= maxDistanceKm;
      // if (!isNearby) console.log(`Store ${store.name} is too far: ${store.distance.toFixed(2)}km`);
      return isNearby;
    });

  // Fallback: If no stores found within the radius, return the closest 5 stores regardless of distance
  // This ensures the screen is never empty unless there are truly no stores in the DB
  if (nearbyStores.length === 0 && stores.length > 0) {
    console.log(`⚠️ No stores found within ${maxDistanceKm}km. Returning closest 10 stores as fallback.`);
    nearbyStores = stores
      .map(store => {
        const primaryAddress = store.addresses ? (store.addresses.find(a => a.isDefault) || store.addresses[0]) : null;
        const addressString = primaryAddress
          ? `${primaryAddress.street}, ${primaryAddress.city}`
          : "Verified Store";

        return {
          id: store.id,
          name: store.name,
          email: store.email,
          latitude: store.latitude,
          longitude: store.longitude,
          phone: store.phone,
          address: addressString,
          distance: calculateDistance(
            driverLatitude, driverLongitude,
            store.latitude, store.longitude
          )
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
  } else {
    nearbyStores = nearbyStores.sort((a, b) => a.distance - b.distance).slice(0, limit);
  }

  console.log(`Returning ${nearbyStores.length} stores to client`);

  console.log(`Returning ${nearbyStores.length} stores to client`);

  return {
    stores: nearbyStores,
    totalStores: nearbyStores.length,
    searchCenter: { latitude: driverLatitude, longitude: driverLongitude },
    searchRadius: maxDistanceKm
  };
}

/**
 * Get stores with specific products (for drivers looking for delivery opportunities)
 */
async function getStoresWithProducts(productIds, driverLatitude = null, driverLongitude = null, maxDistanceKm = 50) {
  const productRepo = AppDataSource.getRepository(Product);
  const userRepo = AppDataSource.getRepository(User);

  // Find all specified products
  const products = await productRepo.find({
    where: { id: productIds },
    relations: ['owner']
  });

  if (products.length === 0) {
    return { stores: [], totalStores: 0 };
  }

  // Get all relevant store IDs
  const storeIds = new Set();

  products.forEach(product => {
    if (product.isGlobal) {
      // For global products, we need to find stores that have instances
      // This is more complex and would require additional queries
      storeIds.add(product.ownerId); // Simplified for now
    } else {
      // For personal products, add the owner
      storeIds.add(product.ownerId);
    }
  });

  // Get store details
  const stores = await userRepo.find({
    where: {
      id: [...storeIds],
      role: 'SUPERMARKET',
      status: 'ACTIVE',
      locationVerified: true
    },
    select: ['id', 'name', 'email', 'latitude', 'longitude', 'phone']
  });

  // Filter by distance if driver location is provided
  let result = stores;
  if (driverLatitude && driverLongitude) {
    result = stores
      .map(store => ({
        ...store,
        distance: calculateDistance(
          driverLatitude, driverLongitude,
          store.latitude, store.longitude
        )
      }))
      .filter(store => store.distance <= maxDistanceKm)
      .sort((a, b) => a.distance - b.distance);
  }

  return {
    stores: result,
    totalStores: result.length,
    productIds,
    searchRadius: maxDistanceKm
  };
}

module.exports = {
  getStoreLocationsForProduct,
  getNearbyStores,
  getStoresWithProducts
};
