const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { GlobalProduct } = require('../entities/GlobalProduct');
const { Product } = require('../entities/Product');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for global product image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/global-products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'global-product-' + uniqueSuffix + path.extname(file.originalname));
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

const getGlobalProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, categoryId } = req.query;
  
  const repo = AppDataSource.getRepository(GlobalProduct);
  let query = repo.createQueryBuilder('gp')
    .leftJoinAndSelect('gp.category', 'category');

  if (categoryId) {
    query = query.where('gp.categoryId = :categoryId', { categoryId });
  }

  query = query
    .orderBy('gp.createdAt', 'DESC')
    .skip((page - 1) * limit)
    .take(limit);

  const [products, total] = await query.getManyAndCount();

  res.json({
    products,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
  });
});

const addGlobalProductToStore = asyncHandler(async (req, res) => {
  const { globalProductId } = req.params;
  const { price } = req.body;

  const globalProductRepo = AppDataSource.getRepository(GlobalProduct);
  const productRepo = AppDataSource.getRepository('Product');

  const globalProduct = await globalProductRepo.findOne({
    where: { id: globalProductId },
    relations: ['category']
  });

  if (!globalProduct) {
    return res.status(404).json({ message: 'Global product not found' });
  }

  const existing = await productRepo.findOne({
    where: { ownerId: req.user.id, globalProductId }
  });

  if (existing) {
    return res.status(400).json({ message: 'Product already in catalog' });
  }

  const product = productRepo.create({
    ownerId: req.user.id,
    globalProductId,
    name: globalProduct.name,
    description: globalProduct.description,
    price,
    imageUrl: globalProduct.image,  // Use image field
    categoryId: globalProduct.categoryId,
    brand: globalProduct.brand,
    weight: globalProduct.weight,
    nutritionalInfo: globalProduct.nutritionalInfo
  });

  const saved = await productRepo.save(product);
  res.status(201).json(saved);
});

// Admin: Create global product
const createGlobalProduct = asyncHandler(async (req, res) => {
  const { name, description, categoryId, brand, weight, nutritionalInfo, image } = req.body;

  if (!name || !categoryId) {
    return res.status(400).json({ message: 'name and categoryId are required' });
  }

  const repo = AppDataSource.getRepository(GlobalProduct);
  const globalProduct = repo.create({
    name,
    description,
    categoryId,
    brand,
    weight,
    nutritionalInfo,
    image  // Use image field
  });

  const saved = await repo.save(globalProduct);
  const productWithCategory = await repo.findOne({
    where: { id: saved.id },
    relations: ['category']
  });

  res.status(201).json(productWithCategory);
});

// Admin: Update global product
const updateGlobalProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const repo = AppDataSource.getRepository(GlobalProduct);
  const globalProduct = await repo.findOne({ where: { id } });

  if (!globalProduct) {
    return res.status(404).json({ message: 'Global product not found' });
  }

  delete updates.id;
  delete updates.createdAt;
  updates.updatedAt = new Date();

  await repo.update(id, updates);
  const updated = await repo.findOne({
    where: { id },
    relations: ['category']
  });

  res.json(updated);
});

// Admin: Delete global product
const deleteGlobalProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(GlobalProduct);
  const globalProduct = await repo.findOne({ where: { id } });

  if (!globalProduct) {
    return res.status(404).json({ message: 'Global product not found' });
  }

  // Delete image if exists
  if (globalProduct.image) {
    const imagePath = path.join(__dirname, '../../uploads/global-products', path.basename(globalProduct.image));
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  await repo.remove(globalProduct);
  res.status(204).send();
});

// Admin: Upload global product image
const uploadGlobalProductImage = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(GlobalProduct);
  const globalProduct = await repo.findOne({ where: { id } });

  if (!globalProduct) {
    return res.status(404).json({ message: 'Global product not found' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided' });
  }

  // Delete old image if exists
  if (globalProduct.image) {
    const oldImagePath = path.join(__dirname, '../../uploads/global-products', path.basename(globalProduct.image));
    if (fs.existsSync(oldImagePath)) {
      fs.unlinkSync(oldImagePath);
    }
  }

  const image = `/uploads/global-products/${req.file.filename}`;
  await repo.update(id, { image, updatedAt: new Date() });

  const updated = await repo.findOne({
    where: { id },
    relations: ['category']
  });

  res.json(updated);
});

module.exports = { 
  getGlobalProducts, 
  addGlobalProductToStore,
  createGlobalProduct,
  updateGlobalProduct,
  deleteGlobalProduct,
  uploadGlobalProductImage,
  upload
};