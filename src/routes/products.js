const express = require('express');
const { 
  getProducts, 
  getProductById,
  getProductByIdForStore,
  getStoreProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  upload
} = require('../controllers/productController');
const { getGlobalProducts, addGlobalProductToStore } = require('../controllers/globalProductController');
const { verifyToken, requireRole, optionalAuth } = require('../middleware/authenticattion');

const router = express.Router();

// Public product routes (with optional auth for favorites)
router.get('/', optionalAuth, getProducts);

// Store products endpoints (must come before /:id route)
router.get('/my-store', verifyToken, requireRole('SUPERMARKET'), getStoreProducts);
router.get('/my-store/:id', verifyToken, requireRole('SUPERMARKET'), getProductByIdForStore);

// Global products (must come before /:id route)
router.get('/global', getGlobalProducts);

// Public product by ID (with optional auth for favorites)
router.get('/:id', optionalAuth, getProductById);

// Supermarket product management
router.post('/', verifyToken, requireRole('SUPERMARKET'), createProduct);
router.put('/:id', verifyToken, requireRole('SUPERMARKET'), updateProduct);
router.delete('/:id', verifyToken, requireRole('SUPERMARKET'), deleteProduct);
router.post('/:id/image', verifyToken, requireRole('SUPERMARKET'), upload.single('image'), uploadProductImage);

// Global products with ID
router.post('/global/:globalProductId/add-to-store', verifyToken, requireRole('SUPERMARKET'), addGlobalProductToStore);

module.exports = router;
