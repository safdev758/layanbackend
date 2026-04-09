const express = require('express');
const { verifyToken, requireRole } = require('../middleware/authenticattion');
const { listUsers, updateUserStatus, getSettings, setSettings, getStats, getAllOrders } = require('../controllers/adminController');
const {
  getGlobalProducts,
  createGlobalProduct,
  updateGlobalProduct,
  deleteGlobalProduct,
  uploadGlobalProductImage,
  upload
} = require('../controllers/globalProductController');
const { createAd, listAds, toggleAd, deleteAd } = require('../controllers/advertisementController');

const router = express.Router();

// All admin routes require admin role
router.use(verifyToken, requireRole('ADMIN'));

// Dashboard stats
router.get('/stats', getStats);

// Orders management
router.get('/orders', getAllOrders);

// Users management
router.get('/users', listUsers);
router.patch('/users/:id/status', updateUserStatus);

// Settings management
router.get('/settings', getSettings);
router.put('/settings', setSettings);

// Global products management
router.get('/global-products', getGlobalProducts);
router.post('/global-products', createGlobalProduct);
router.put('/global-products/:id', updateGlobalProduct);
router.delete('/global-products/:id', deleteGlobalProduct);
router.post('/global-products/:id/image', upload.single('image'), uploadGlobalProductImage);

// Advertisements management
router.get('/advertisements', listAds);
router.post('/advertisements', createAd); // expects { imageBase64, description }
router.patch('/advertisements/:id/toggle', toggleAd);
router.delete('/advertisements/:id', deleteAd);

module.exports = router;
