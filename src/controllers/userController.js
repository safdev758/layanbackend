const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { User } = require('../entities/User');
const { Address } = require('../entities/Address');
const { Product } = require('../entities/Product');

const getCurrentUser = asyncHandler(async (req, res) => {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({
    where: { id: req.user.id },
    relations: ['addresses']
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Remove sensitive data
  const { passwordHash, otpCode, otpExpiry, ...userProfile } = user;
  
  res.json(userProfile);
});
const updateCurrentUser = asyncHandler(async (req, res) => {
  const repo = AppDataSource.getRepository(User);
  const allowedFields = ['name', 'phone', 'profileImage', 'preferences'];
  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'No valid fields to update' });
  }

  updates.updatedAt = new Date();

  await repo.update(req.user.id, updates);
  const updatedUser = await repo.findOne({
    where: { id: req.user.id },
    relations: ['addresses']
  });

  // Remove sensitive data
  const { passwordHash, otpCode, otpExpiry, ...userProfile } = updatedUser;
  
  res.json(userProfile);
});

// Get user by ID (public view)
const getUserById = asyncHandler(async (req, res) => {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({
    where: { id: req.params.id }
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Only return public information
  const publicProfile = {
    id: user.id,
    name: user.name,
    profileImage: user.profileImage,
    role: user.role
  };

  // If requesting own profile or admin, return more details
  if (req.user.id === user.id || req.user.role === 'ADMIN') {
    const { passwordHash, otpCode, otpExpiry, ...userProfile } = user;
    return res.json(userProfile);
  }

  res.json(publicProfile);
});

// Add address
const addAddress = asyncHandler(async (req, res) => {
  const { title, street, city, state, zipCode, country, isDefault, deliveryInstructions, latitude, longitude } = req.body;

  if (!street || !city || !state || !zipCode || !country) {
    return res.status(400).json({ 
      message: 'street, city, state, zipCode, and country are required' 
    });
  }

  const addressRepo = AppDataSource.getRepository(Address);
  const userRepo = AppDataSource.getRepository(User);

  // If this is set as default, unset other defaults
  if (isDefault) {
    await addressRepo.update(
      { userId: req.user.id },
      { isDefault: false }
    );
  }

  const address = addressRepo.create({
    userId: req.user.id,
    title,
    street,
    city,
    state,
    zipCode,
    country,
    isDefault: isDefault || false,
    deliveryInstructions,
    latitude: latitude || null,
    longitude: longitude || null
  });

  const savedAddress = await addressRepo.save(address);
  res.status(201).json(savedAddress);
});

// Update address
const updateAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;
  const { title, street, city, state, zipCode, country, isDefault, deliveryInstructions } = req.body;

  const addressRepo = AppDataSource.getRepository(Address);
  const address = await addressRepo.findOne({
    where: { id: addressId, userId: req.user.id }
  });

  if (!address) {
    return res.status(404).json({ message: 'Address not found' });
  }

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (street !== undefined) updates.street = street;
  if (city !== undefined) updates.city = city;
  if (state !== undefined) updates.state = state;
  if (zipCode !== undefined) updates.zipCode = zipCode;
  if (country !== undefined) updates.country = country;
  if (deliveryInstructions !== undefined) updates.deliveryInstructions = deliveryInstructions;
  if (isDefault !== undefined) updates.isDefault = isDefault;

  // If this is set as default, unset other defaults
  if (isDefault) {
    await addressRepo.update(
      { userId: req.user.id },
      { isDefault: false }
    );
  }

  await addressRepo.update(addressId, updates);
  const updatedAddress = await addressRepo.findOne({ where: { id: addressId } });
  
  res.json(updatedAddress);
});

// Delete address
const deleteAddress = asyncHandler(async (req, res) => {
  const { addressId } = req.params;

  const addressRepo = AppDataSource.getRepository(Address);
  const address = await addressRepo.findOne({
    where: { id: addressId, userId: req.user.id }
  });

  if (!address) {
    return res.status(404).json({ message: 'Address not found' });
  }

  await addressRepo.remove(address);
  res.status(204).send();
});

// Add product to favorites
const addToFavorites = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ message: 'Product ID is required' });
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: req.user.id } });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const favorites = user.preferences?.favorites || [];
  
  if (!favorites.includes(productId)) {
    favorites.push(productId);
    await userRepo.update(req.user.id, {
      preferences: { ...user.preferences, favorites }
    });
  }

  res.json({ favorites });
});

// Get current user's favorites (full product objects)
const getFavorites = asyncHandler(async (req, res) => {
  const userRepo = AppDataSource.getRepository(User);
  const productRepo = AppDataSource.getRepository(Product);

  const user = await userRepo.findOne({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const favorites = user.preferences?.favorites || [];
  if (!favorites || favorites.length === 0) return res.json([]);

  // Fetch each product (Promise.all) and filter missing ones
  const products = await Promise.all(favorites.map(id => productRepo.findOne({ where: { id } })));
  const existing = products.filter(Boolean);
  // Return JSON array of product objects (frontend expects an array)
  res.json(existing);
});

// Remove product from favorites
const removeFromFavorites = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: req.user.id } });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const favorites = user.preferences?.favorites || [];
  const updatedFavorites = favorites.filter(id => id !== productId);

  await userRepo.update(req.user.id, {
    preferences: { ...user.preferences, favorites: updatedFavorites }
  });

  res.json({ favorites: updatedFavorites });
});

// Get addresses for the current user
const getUserAddresses = asyncHandler(async (req, res) => {
  const addressRepo = AppDataSource.getRepository(Address);

  const addresses = await addressRepo.find({
    where: { userId: req.user.id },
    order: { createdAt: 'DESC' }
  });

  res.json({
    data: addresses
  });
});

// Update user location (for stores)
const updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ message: 'Latitude and longitude are required' });
  }

  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { id: req.user.id } });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const updates = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    updatedAt: new Date()
  };

  // If user is a store with PENDING status, activate them
  if (user.role === 'SUPERMARKET' && user.status === 'PENDING') {
    updates.status = 'ACTIVE';
  }

  await repo.update(req.user.id, updates);
  const updatedUser = await repo.findOne({ where: { id: req.user.id } });

  const { passwordHash, otpCode, otpExpiry, ...userProfile } = updatedUser;
  res.json(userProfile);
});

// Register push notification token
const registerPushToken = asyncHandler(async (req, res) => {
  const { token, platform = 'fcm' } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }

  const repo = AppDataSource.getRepository(User);
  const updateData = platform === 'apns' 
    ? { apnsToken: token }
    : { fcmToken: token };

  await repo.update(req.user.id, updateData);
  res.json({ message: 'Push token registered successfully', platform });
});

// Unregister push notification token
const unregisterPushToken = asyncHandler(async (req, res) => {
  const { platform = 'fcm' } = req.body;

  const repo = AppDataSource.getRepository(User);
  const updateData = platform === 'apns'
    ? { apnsToken: null }
    : { fcmToken: null };

  await repo.update(req.user.id, updateData);
  res.json({ message: 'Push token unregistered successfully', platform });
});

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  getUserById,
  addAddress,
  updateAddress,
  deleteAddress,
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  getUserAddresses,
  updateLocation,
  registerPushToken,
  unregisterPushToken,
};
