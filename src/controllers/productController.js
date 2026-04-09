const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { Product } = require('../entities/Product');
const { User } = require('../entities/User');
const { OrderItem } = require('../entities/OrderItem');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

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

function buildImagesPayload(images, imageUrl) {
  let normalizedImages = [];

  if (Array.isArray(images)) {
    normalizedImages = images.filter((img) => img && (isBase64Image(img) || isDisplayableImageUrl(img)));
  } else if (typeof images === 'string' && (isBase64Image(images) || isDisplayableImageUrl(images))) {
    normalizedImages = [images];
  }

  if (normalizedImages.length === 0 && imageUrl && (isBase64Image(imageUrl) || isDisplayableImageUrl(imageUrl))) {
    normalizedImages = [imageUrl];
  }

  // Keep base64 in images[] but avoid writing it into products.image (varchar(500) in DB).
  const firstImage = normalizedImages[0] || null;
  const safeImageUrl = firstImage && !isBase64Image(firstImage) ? firstImage : null;

  return { normalizedImages, safeImageUrl };
}

// Get all products with filtering and pagination
const getProducts = asyncHandler(async (req, res) => {
  const { 
    q, 
    categoryId, 
    onSale, 
    sort = 'name', 
    page = 1, 
    limit = 20,
    minPrice,
    maxPrice
  } = req.query;

  const repo = AppDataSource.getRepository(Product);
  
  // Get user's favorite product IDs from preferences JSON (only if user is authenticated)
  let favouritesIds = [];
  if (req.user && req.user.id) {
    try {
      const userRepo = AppDataSource.getRepository(User);
      const user = await userRepo.findOne({ where: { id: req.user.id } });
      if (user && user.preferences && Array.isArray(user.preferences.favorites)) {
        favouritesIds = user.preferences.favorites;
        console.log(`[Products] User ${user.id} has ${favouritesIds.length} favorites from preferences`);
      } else {
        console.log('[Products] Preferences missing or favorites not an array; defaulting to empty list');
      }
    } catch (error) {
      console.log('Error reading user preferences:', error.message);
      // Continue without favorites for guest users
    }
  } else {
    console.log('[Products] No authenticated user - all products will have isFavourite: false');
  }

  let query = repo.createQueryBuilder('product')
    .leftJoinAndSelect('product.category', 'category')
    .leftJoinAndSelect('product.owner', 'owner');

  // IMPORTANT: Filter OUT Global Products - users should only see Store Products
  // Global Products (isGlobal = true) are templates for supermarkets
  // Store Products (isGlobal = false) are what users can actually order
  query = query.andWhere('product.isGlobal = :isGlobal', { isGlobal: false });

  // IMPORTANT: For SUPERMARKET role, show only THEIR own products
  // For CUSTOMER role, show all store products
  if (req.user && req.user.role === 'SUPERMARKET') {
    query = query.andWhere('product.ownerId = :ownerId', { ownerId: req.user.id });
    console.log(`[Products] Filtering products for SUPERMARKET user ${req.user.id}`);
  }

  // Search query
  if (q) {
    query = query.andWhere(
      '(product.name ILIKE :search OR product.description ILIKE :search)',
      { search: `%${q}%` }
    );
  }

  // Category filter
  if (categoryId) {
    if (q) {
      query = query.andWhere('product.categoryId = :categoryId', { categoryId });
    } else {
      query = query.where('product.categoryId = :categoryId', { categoryId });
    }
  }

  // On sale filter
  if (onSale === 'true') {
    const whereClause = q || categoryId ? 'andWhere' : 'where';
    query = query[whereClause]('product.isOnSale = :onSale', { onSale: true });
  }

  // Price filters
  if (minPrice) {
    const whereClause = q || categoryId || onSale === 'true' ? 'andWhere' : 'where';
    query = query[whereClause]('product.price >= :minPrice', { minPrice: parseFloat(minPrice) });
  }
  if (maxPrice) {
    const whereClause = q || categoryId || onSale === 'true' || minPrice ? 'andWhere' : 'where';
    query = query[whereClause]('product.price <= :maxPrice', { maxPrice: parseFloat(maxPrice) });
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

  // Add isFavourite field and set imageUrl from images array
  const productsWithFavourites = products.map(product => {
    const isFav = favouritesIds.includes(product.id);
    return {
      ...product,
      imageUrl: product.images && product.images.length > 0 ? product.images[0] : product.imageUrl,
      isFavourite: isFav
    };
  });

  res.json({
    products: productsWithFavourites,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// Get product by ID with reviews
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const repo = AppDataSource.getRepository(Product);
  const product = await repo.findOne({
    where: { id, isGlobal: false }, // Only allow access to Store Products
    relations: ['category', 'reviews', 'owner']
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found or not accessible' });
  }

  res.json(product);
});

// Get product by ID for store (optimized for updates)
const getProductByIdForStore = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const startTime = Date.now();
  
  console.log(`[GetProductById] Loading product ${id} for user ${req.user.id}`);

  const repo = AppDataSource.getRepository(Product);
  
  try {
    // Optimized query with only necessary fields
    const product = await repo.findOne({
      where: { id, ownerId: req.user.id },
      select: [
        'id', 'name', 'price', 'originalPrice', 'description', 
        'categoryId', 'images', 'imageUrl', 'image', 'brand', 
        'weight', 'expiryDate', 'nutritionalInfo', 'isActive', 
        'createdAt', 'updatedAt'
      ]
    });

    if (!product) {
      console.log(`[GetProductById] Product ${id} not found for user ${req.user.id}`);
      return res.status(404).json({ message: 'Product not found or access denied' });
    }

    const queryTime = Date.now() - startTime;
    
    // Process image data
    const processedProduct = {
      ...product,
      imageUrl: product.images && product.images.length > 0 ? product.images[0] : product.imageUrl,
      hasImages: product.images && product.images.length > 0,
      imageCount: product.images ? product.images.length : 0
    };

    const totalTime = Date.now() - startTime;
    console.log(`[GetProductById] Completed in ${totalTime}ms for product ${id}`);

    // Add performance headers
    res.set({
      'Cache-Control': 'private, max-age=10',
      'X-Response-Time': `${totalTime}ms`
    });

    res.json({
      ...processedProduct,
      performance: {
        queryTime: `${queryTime}ms`,
        totalTime: `${totalTime}ms`
      }
    });

  } catch (error) {
    console.error(`[GetProductById] Error loading product ${id}:`, error);
    res.status(500).json({ 
      message: 'Error loading product', 
      error: error.message 
    });
  }
});

// Get products for the authenticated store
const getStoreProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isActive, forceRefresh } = req.query;
  const startTime = Date.now();

  console.log(`[StoreProducts] Loading products for user ${req.user.id} - page: ${page}, limit: ${limit}, forceRefresh: ${forceRefresh}`);

  const productRepo = AppDataSource.getRepository(Product);
  
  try {
    // Build optimized query with only necessary fields
    let query = productRepo.createQueryBuilder('product')
      .select([
        'product.id',
        'product.name', 
        'product.price',
        'product.originalPrice',
        'product.description',
        'product.categoryId',
        'product.images',
        'product.imageUrl',
        'product.brand',
        'product.weight',
        'product.createdAt',
        'product.updatedAt'
      ])
      .where('product.ownerId = :ownerId', { ownerId: req.user.id });

    // Order by most recent updates first for better UX
    query = query.orderBy('product.updatedAt', 'DESC');

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    query = query.skip(skip).take(parseInt(limit));

    // Execute query with performance logging
    const [products, total] = await query.getManyAndCount();
    const queryTime = Date.now() - startTime;

    console.log(`[StoreProducts] Query completed in ${queryTime}ms - Found ${products.length} products out of ${total} total`);

    // Process images efficiently
    const productsWithImages = products.map(product => {
      // Set imageUrl from images array for supermarket products
      const imageUrl = product.images && product.images.length > 0 ? product.images[0] : product.imageUrl;
      
      return {
        ...product,
        imageUrl: imageUrl || null,
        hasImages: product.images && product.images.length > 0
      };
    });

    const totalTime = Date.now() - startTime;
    console.log(`[StoreProducts] Total processing time: ${totalTime}ms`);

    // Add cache headers for better performance
    res.set({
      'Cache-Control': forceRefresh === 'true' ? 'no-cache' : 'private, max-age=30',
      'X-Response-Time': `${totalTime}ms`,
      'X-Total-Products': total.toString()
    });

    res.json({
      products: productsWithImages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      performance: {
        queryTime: `${queryTime}ms`,
        totalTime: `${totalTime}ms`,
        productCount: products.length
      }
    });

  } catch (error) {
    console.error(`[StoreProducts] Error loading products:`, error);
    res.status(500).json({ 
      message: 'Error loading products', 
      error: error.message 
    });
  }
});

// Create product for the authenticated store
const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    price,
    originalPrice,
    imageUrl,
    categoryId,
    description,
    images,
    brand,
    weight,
    expiryDate,
    nutritionalInfo
  } = req.body;

  if (!name || !price || !categoryId) {
    return res.status(400).json({ 
      message: 'name, price, and categoryId are required' 
    });
  }

  const { normalizedImages, safeImageUrl } = buildImagesPayload(images, imageUrl);
  
  const repo = AppDataSource.getRepository(Product);
  const product = repo.create({
    ownerId: req.user.id,
    name,
    price,
    originalPrice,
    imageUrl: safeImageUrl,
    categoryId,
    description,
    images: normalizedImages,
    brand,
    weight,
    expiryDate,
    nutritionalInfo
  });

  const savedProduct = await repo.save(product);
  const productWithCategory = await repo.findOne({
    where: { id: savedProduct.id },
    relations: ['category']
  });

  res.status(201).json(productWithCategory);
});

// Update product for the authenticated store
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  console.log(`[UpdateProduct] Starting update for product ${id} by user ${req.user.id}`);

  const repo = AppDataSource.getRepository(Product);
  
  // Use a more efficient query to check existence and get product in one go
  const product = await repo.findOne({
    where: { id, ownerId: req.user.id },
    select: ['id', 'ownerId', 'images', 'imageUrl'] // Only select needed fields
  });

  if (!product) {
    console.log(`[UpdateProduct] Product ${id} not found or access denied`);
    return res.status(404).json({ message: 'Product not found or access denied' });
  }

  // Remove fields that shouldn't be updated directly
  delete updates.id;
  delete updates.ownerId;
  delete updates.rating;
  delete updates.reviewCount;
  delete updates.createdAt;

  // Handle image updates more efficiently
  const hasImageUpdate = updates.images || updates.imageUrl;
  
  if (hasImageUpdate) {
    console.log(`[UpdateProduct] Processing image update for product ${id}`);
    const { normalizedImages, safeImageUrl } = buildImagesPayload(updates.images, updates.imageUrl);
    updates.images = normalizedImages;
    updates.imageUrl = safeImageUrl;
    console.log(`[UpdateProduct] Updated images array with ${updates.images.length} images`);
  }

  updates.updatedAt = new Date();

  try {
    // Use update() with return: true to get the updated product efficiently
    const updateResult = await repo.update(id, updates);
    
    if (updateResult.affected === 0) {
      console.log(`[UpdateProduct] No rows affected for product ${id}`);
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get the updated product with all fields including images
    const updatedProduct = await repo.findOne({
      where: { id },
      relations: ['category'],
      select: [
        'id', 'name', 'price', 'originalPrice', 'description', 
        'categoryId', 'images', 'imageUrl', 'brand', 
        'weight', 'expiryDate', 'nutritionalInfo', 
        'createdAt', 'updatedAt', 'ownerId', 'isGlobal', 
        'globalProductId', 'rating', 'reviewCount'
      ]
    });

    if (!updatedProduct) {
      console.log(`[UpdateProduct] Failed to retrieve updated product ${id}`);
      return res.status(500).json({ message: 'Failed to retrieve updated product' });
    }

    console.log(`[UpdateProduct] Successfully updated product ${id} with images: ${updatedProduct.images?.length || 0}`);

    res.json(updatedProduct);
  } catch (error) {
    console.error(`[UpdateProduct] Error updating product ${id}:`, error);
    res.status(500).json({ 
      message: 'Error updating product', 
      error: error.message 
    });
  }
});

// Delete product for the authenticated store
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Product);
  
  const product = await repo.findOne({
    where: { id, ownerId: req.user.id }
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found or access denied' });
  }

  try {
    // Try to delete the product
    await repo.remove(product);
    console.log(`[DeleteProduct] Successfully deleted product ${id}`);
    res.status(204).send();
  } catch (error) {
    // If foreign key constraint exists, soft delete by setting a flag
    if (error.message.includes('foreign key constraint')) {
      console.log(`[DeleteProduct] Foreign key constraint, soft deleting product ${id}`);
      // Add a deletedAt timestamp for soft delete
      product.deletedAt = new Date();
      await repo.save(product);
      res.status(204).send();
    } else {
      console.error(`[DeleteProduct] Error deleting product ${id}:`, error);
      res.status(500).json({ 
        message: 'Error deleting product', 
        error: error.message 
      });
    }
  }
});

// Upload product image
const uploadProductImage = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Product);
  const product = await repo.findOne({
    where: { id, ownerId: req.user.id }
  });

  if (!product) {
    return res.status(404).json({ message: 'Product not found or access denied' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided' });
  }

  // Delete old image if exists
  if (product.imageUrl) {
    const oldImagePath = path.join(__dirname, '../../uploads/products', path.basename(product.imageUrl));
    if (fs.existsSync(oldImagePath)) {
      fs.unlinkSync(oldImagePath);
    }
  }

  // Update product with new image URL
  const imageUrl = `/uploads/products/${req.file.filename}`;
  await repo.update(id, { imageUrl, updatedAt: new Date() });

  const updatedProduct = await repo.findOne({
    where: { id },
    relations: ['category']
  });

  res.json(updatedProduct);
});

module.exports = {
  getProducts,
  getProductById,
  getProductByIdForStore,
  getStoreProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  upload,
};
