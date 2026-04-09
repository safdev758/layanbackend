const express = require('express');
const {
  search,
  searchProducts,
  getSearchSuggestions,
  getTrendingSearches,
  advancedSearch
} = require('../controllers/searchController');
const { optionalAuth } = require('../middleware/authenticattion');

const router = express.Router();

// Search routes (public with optional auth for personalized results)
router.get('/', optionalAuth, search);
router.get('/products', optionalAuth, searchProducts);
router.get('/suggestions', getSearchSuggestions);
router.get('/trending', getTrendingSearches);
router.post('/advanced', optionalAuth, advancedSearch);

module.exports = router;
