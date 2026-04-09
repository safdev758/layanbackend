const express = require('express');
const {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  markReviewHelpful,
  getUserReviews
} = require('../controllers/reviewController');
const { verifyToken } = require('../middleware/authenticattion');

const router = express.Router();

// Product reviews routes
router.post('/:productId', verifyToken, createReview);
router.get('/:productId', getProductReviews);

// Review management routes
router.put('/:reviewId', verifyToken, updateReview);
router.delete('/:reviewId', verifyToken, deleteReview);
router.post('/:reviewId/helpful', markReviewHelpful);

// User reviews
router.get('/user/:userId', verifyToken, getUserReviews);

module.exports = router;
