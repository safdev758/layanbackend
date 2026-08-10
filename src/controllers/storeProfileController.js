const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { StoreProfile } = require('../entities/StoreProfile');
const { User } = require('../entities/User');

function isBase64Image(value) {
  return typeof value === 'string' && value.startsWith('data:image');
}

function isDisplayableImageUrl(value) {
  return typeof value === 'string' && (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/uploads/')
  );
}

function normalizeStoreProfileMedia(profileImage, images) {
  let normalizedImages = [];

  if (Array.isArray(images)) {
    normalizedImages = images.filter(
      (img) => img && (isBase64Image(img) || isDisplayableImageUrl(img))
    );
  } else if (typeof images === 'string' && (isBase64Image(images) || isDisplayableImageUrl(images))) {
    normalizedImages = [images];
  }

  if (profileImage && (isBase64Image(profileImage) || isDisplayableImageUrl(profileImage))) {
    if (!normalizedImages.includes(profileImage)) {
      normalizedImages = [profileImage, ...normalizedImages];
    }
  }

  const primaryImage = normalizedImages[0] || null;
  return {
    profileImage: primaryImage,
    images: normalizedImages,
  };
}

function serializeStoreProfile(profile, user = null) {
  return {
    id: profile.userId,
    profileId: profile.id,
    userId: profile.userId,
    name: profile.displayName,
    displayName: profile.displayName,
    phone: profile.phone,
    profileImage: profile.profileImage,
    images: profile.images || [],
    description: profile.description,
    latitude: profile.latitude,
    longitude: profile.longitude,
    email: user?.email || null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

async function findOrCreateProfileForUser(user) {
  const repo = AppDataSource.getRepository(StoreProfile);
  let profile = await repo.findOne({ where: { userId: user.id } });
  if (profile) return profile;

  profile = repo.create({
    userId: user.id,
    displayName: user.name,
    phone: user.phone,
    profileImage: user.profileImage,
    latitude: user.latitude,
    longitude: user.longitude,
    images: user.profileImage ? [user.profileImage] : [],
  });
  return repo.save(profile);
}

const getStoreProfileById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const profileRepo = AppDataSource.getRepository(StoreProfile);
  const userRepo = AppDataSource.getRepository(User);

  let profile = await profileRepo.findOne({ where: { userId: id } });
  if (!profile) {
    profile = await profileRepo.findOne({ where: { id } });
  }

  if (!profile) {
    const user = await userRepo.findOne({
      where: { id, role: 'SUPERMARKET', status: 'ACTIVE' },
    });
    if (!user) {
      return res.status(404).json({ message: 'Store profile not found' });
    }
    profile = await findOrCreateProfileForUser(user);
  }

  const user = await userRepo.findOne({ where: { id: profile.userId } });
  if (!user || user.role !== 'SUPERMARKET' || user.status !== 'ACTIVE') {
    return res.status(404).json({ message: 'Store profile not found' });
  }

  res.json(serializeStoreProfile(profile, user));
});

const getMyStoreProfile = asyncHandler(async (req, res) => {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: req.user.id } });

  if (!user || user.role !== 'SUPERMARKET') {
    return res.status(403).json({ message: 'Only supermarket accounts have store profiles' });
  }

  const profile = await findOrCreateProfileForUser(user);
  res.json(serializeStoreProfile(profile, user));
});

const updateMyStoreProfile = asyncHandler(async (req, res) => {
  const userRepo = AppDataSource.getRepository(User);
  const profileRepo = AppDataSource.getRepository(StoreProfile);

  const user = await userRepo.findOne({ where: { id: req.user.id } });
  if (!user || user.role !== 'SUPERMARKET') {
    return res.status(403).json({ message: 'Only supermarket accounts can update store profiles' });
  }

  const allowedFields = ['displayName', 'phone', 'description', 'latitude', 'longitude'];
  const updates = {};
  Object.keys(req.body).forEach((key) => {
    if (allowedFields.includes(key)) {
      updates[key] = req.body[key];
    }
  });

  if (req.body.profileImage !== undefined || req.body.images !== undefined) {
    const media = normalizeStoreProfileMedia(req.body.profileImage, req.body.images);
    updates.profileImage = media.profileImage;
    updates.images = media.images;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'No valid fields to update' });
  }

  let profile = await profileRepo.findOne({ where: { userId: user.id } });
  if (!profile) {
    profile = await findOrCreateProfileForUser(user);
  }

  Object.assign(profile, updates, { updatedAt: new Date() });
  const saved = await profileRepo.save(profile);

  // Keep user.latitude/longitude in sync so order pickup resolution and maps stay consistent
  if (updates.latitude !== undefined || updates.longitude !== undefined) {
    const userUpdates = {};
    if (updates.latitude !== undefined) userUpdates.latitude = updates.latitude;
    if (updates.longitude !== undefined) userUpdates.longitude = updates.longitude;
    await userRepo.update(user.id, userUpdates);
    Object.assign(user, userUpdates);
  }

  res.json(serializeStoreProfile(saved, user));
});

module.exports = {
  getStoreProfileById,
  getMyStoreProfile,
  updateMyStoreProfile,
  serializeStoreProfile,
  findOrCreateProfileForUser,
};
