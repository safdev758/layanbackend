const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { Category } = require('../entities/Category');
const {
  resolveCustomerCoords,
  parseRadiusKm,
  applyNearbyOwnerFilter,
  DEFAULT_MARKETPLACE_RADIUS_KM,
} = require('../services/nearbyStoreFilter');

// Get all categories
const getCategories = asyncHandler(async (req, res) => {
  const repo = AppDataSource.getRepository(Category);
  const categories = await repo.find({
    order: { name: 'ASC' }
  });

  res.json(categories);
});

// Get category by ID
const getCategoryById = asyncHandler(async (req, res) => {
  const repo = AppDataSource.getRepository(Category);
  const category = await repo.findOne({
    where: { id: req.params.id }
  });

  if (!category) {
    return res.status(404).json({ message: 'Category not found' });
  }

  res.json(category);
});

// Get products in category
const getCategoryProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    page = 1, 
    limit = 20, 
    q, 
    sort = 'name', 
    minPrice, 
    maxPrice,
    radius_km,
  } = req.query;

  const isStoreOwner = req.user && req.user.role === 'SUPERMARKET';
  const customerCoords = !isStoreOwner ? resolveCustomerCoords(req) : null;
  const radiusKm = parseRadiusKm(radius_km, DEFAULT_MARKETPLACE_RADIUS_KM);

  if (!isStoreOwner && !customerCoords) {
    return res.json({
      products: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
        totalPages: 0,
      },
      code: 'LOCATION_REQUIRED',
      message: 'lat and lng are required to list nearby products',
    });
  }

  const repo = AppDataSource.getRepository('Product');
  let query = repo.createQueryBuilder('product')
    .leftJoinAndSelect('product.category', 'category')
    .leftJoinAndSelect('product.owner', 'owner')
    .where('product.categoryId = :categoryId', { categoryId: id })
    .andWhere('product.isGlobal = :isGlobal', { isGlobal: false });

  if (isStoreOwner) {
    query = query.andWhere('product.ownerId = :ownerId', { ownerId: req.user.id });
  } else {
    query = applyNearbyOwnerFilter(
      query,
      customerCoords.latitude,
      customerCoords.longitude,
      radiusKm
    );
  }

  // Search query
  if (q) {
    query = query.andWhere(
      '(product.name ILIKE :search OR product.description ILIKE :search)',
      { search: `%${q}%` }
    );
  }

  // Price filters
  if (minPrice) {
    query = query.andWhere('product.price >= :minPrice', { minPrice: parseFloat(minPrice) });
  }
  if (maxPrice) {
    query = query.andWhere('product.price <= :maxPrice', { maxPrice: parseFloat(maxPrice) });
  }

  // Sorting
  switch (sort) {
    case 'price_asc':
      query = query.orderBy('product.price', 'ASC');
      break;
    case 'price_desc':
      query = query.orderBy('product.price', 'DESC');
      break;
    case 'rating':
      query = query.orderBy('product.rating', 'DESC');
      break;
    case 'newest':
      query = query.orderBy('product.createdAt', 'DESC');
      break;
    default:
      query = query.orderBy('product.name', 'ASC');
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  query = query.skip(skip).take(parseInt(limit));

  const [products, total] = await query.getManyAndCount();

  res.json({
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  });
});

// Create category (Admin only)
const createCategory = asyncHandler(async (req, res) => {
  const { name, emoji, color, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  const repo = AppDataSource.getRepository(Category);
  const category = repo.create({
    name,
    emoji,
    color,
    description
  });

  const savedCategory = await repo.save(category);
  res.status(201).json(savedCategory);
});

// Update category (Admin only)
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, emoji, color, description } = req.body;

  const repo = AppDataSource.getRepository(Category);
  const category = await repo.findOne({ where: { id } });

  if (!category) {
    return res.status(404).json({ message: 'Category not found' });
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (emoji !== undefined) updates.emoji = emoji;
  if (color !== undefined) updates.color = color;
  if (description !== undefined) updates.description = description;

  await repo.update(id, updates);
  const updatedCategory = await repo.findOne({ where: { id } });

  res.json(updatedCategory);
});

// Delete category (Admin only)
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Category);
  const category = await repo.findOne({ where: { id } });

  if (!category) {
    return res.status(404).json({ message: 'Category not found' });
  }

  await repo.remove(category);
  res.status(204).send();
});

module.exports = {
  getCategories,
  getCategoryById,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory
};
