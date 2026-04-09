const express = require('express');
const {
  getCategories,
  getCategoryById,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/categoryController');
const { verifyToken, requireRole } = require('../middleware/authenticattion');

const router = express.Router();

// Public category routes
router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.get('/:id/products', getCategoryProducts);

// Admin category management
router.post('/', verifyToken, requireRole('ADMIN'), createCategory);
router.put('/:id', verifyToken, requireRole('ADMIN'), updateCategory);
router.delete('/:id', verifyToken, requireRole('ADMIN'), deleteCategory);

module.exports = router;
