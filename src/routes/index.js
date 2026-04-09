const express = require('express');
const marketplaceController = require('../controllers/marketplaceController');
const { getGlobalProducts } = require('../controllers/globalProductController');
const { verifyToken } = require('../middleware/authenticattion');

const { getActiveAd, getActiveAds } = require('../controllers/advertisementController');

const router = express.Router();

// Advertisements (public)
router.get('/advertisements/active', getActiveAd);
router.get('/advertisements/active-list', getActiveAds);

// Global products (public)
router.get('/global-products', getGlobalProducts);

// Marketplace routes
router.get('/marketplace/items', marketplaceController.getMarketplaceItems);
router.post('/marketplace/items', verifyToken, marketplaceController.createMarketplaceItem);
router.get('/marketplace/items/:id', marketplaceController.getMarketplaceItemById);
router.get('/marketplace/items/:itemId/threads', verifyToken, marketplaceController.getItemThreadsForSeller);
router.post('/marketplace/items/:itemId/threads', verifyToken, marketplaceController.createOrGetThread);
router.get('/marketplace/threads/:threadId/messages', verifyToken, marketplaceController.getThreadMessages);
router.post('/marketplace/threads/:threadId/messages', verifyToken, marketplaceController.createThreadMessage);

module.exports = router;
