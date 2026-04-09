const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { Review } = require('../entities/Review');
const { Product } = require('../entities/Product');
const { Order } = require('../entities/Order');

// Create review
const createReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  // Verify product exists
  const productRepo = AppDataSource.getRepository(Product);
  const product = await productRepo.findOne({ where: { id: productId } });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  // Check if user has purchased this product (optional validation)
  const orderRepo = AppDataSource.getRepository(Order);
  const hasPurchased = await orderRepo
    .createQueryBuilder('order')
    .leftJoin('order.items', 'item')
    .where('order.userId = :userId', { userId: req.user.id })
    .andWhere('order.status = :status', { status: 'DELIVERED' })
    .andWhere('item.productId = :productId', { productId })
    .getCount() > 0;

  // Check if user already reviewed this product
  const reviewRepo = AppDataSource.getRepository(Review);
  const existingReview = await reviewRepo.findOne({
    where: { productId, userId: req.user.id }
  });

  if (existingReview) {
    return res.status(400).json({ message: 'You have already reviewed this product' });
  }

  // Create review
  const review = reviewRepo.create({
    productId,
    userId: req.user.id,
    userName: req.user.name,
    rating,
    comment: comment || null
  });

  const savedReview = await reviewRepo.save(review);

  // Update product rating and review count
  await updateProductRating(productId);

  res.status(201).json(savedReview);
});

// Get reviews for a product
const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const reviewRepo = AppDataSource.getRepository(Review);
  const query = reviewRepo.createQueryBuilder('review')
    .where('review.productId = :productId', { productId })
    .orderBy('review.createdAt', 'DESC');

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  query.skip(skip).take(parseInt(limit));

  const [reviews, total] = await query.getManyAndCount();

  res.json({
    reviews,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// Update review (only by the author)
const updateReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment } = req.body;

  const reviewRepo = AppDataSource.getRepository(Review);
  const review = await reviewRepo.findOne({
    where: { id: reviewId, userId: req.user.id }
  });

  if (!review) {
    return res.status(404).json({ message: 'Review not found or access denied' });
  }

  if (rating !== undefined) {
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    review.rating = rating;
  }

  if (comment !== undefined) {
    review.comment = comment;
  }

  const updatedReview = await reviewRepo.save(review);

  // Update product rating
  await updateProductRating(review.productId);

  res.json(updatedReview);
});

// Delete review (only by the author)
const deleteReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  const reviewRepo = AppDataSource.getRepository(Review);
  const review = await reviewRepo.findOne({
    where: { id: reviewId, userId: req.user.id }
  });

  if (!review) {
    return res.status(404).json({ message: 'Review not found or access denied' });
  }

  const productId = review.productId;
  await reviewRepo.remove(review);

  // Update product rating
  await updateProductRating(productId);

  res.status(204).send();
});

// Mark review as helpful
const markReviewHelpful = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  const reviewRepo = AppDataSource.getRepository(Review);
  const review = await reviewRepo.findOne({ where: { id: reviewId } });

  if (!review) {
    return res.status(404).json({ message: 'Review not found' });
  }

  // Increment helpful count
  await reviewRepo.update(reviewId, {
    helpful: review.helpful + 1
  });

  const updatedReview = await reviewRepo.findOne({ where: { id: reviewId } });
  res.json(updatedReview);
});

// Get user's reviews
const getUserReviews = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  // Check if user can access these reviews
  if (req.user.id !== userId && req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const reviewRepo = AppDataSource.getRepository(Review);
  const query = reviewRepo.createQueryBuilder('review')
    .leftJoinAndSelect('review.product', 'product')
    .where('review.userId = :userId', { userId })
    .orderBy('review.createdAt', 'DESC');

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  query.skip(skip).take(parseInt(limit));

  const [reviews, total] = await query.getManyAndCount();

  res.json({
    reviews,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// Helper function to update product rating
async function updateProductRating(productId) {
  const reviewRepo = AppDataSource.getRepository(Review);
  const productRepo = AppDataSource.getRepository(Product);

  // Calculate new average rating and review count
  const result = await reviewRepo
    .createQueryBuilder('review')
    .select('AVG(review.rating)', 'avgRating')
    .addSelect('COUNT(review.id)', 'reviewCount')
    .where('review.productId = :productId', { productId })
    .getRawOne();

  const avgRating = parseFloat(result.avgRating) || 0;
  const reviewCount = parseInt(result.reviewCount) || 0;

  // Update product
  await productRepo.update(productId, {
    rating: Math.round(avgRating * 100) / 100, // Round to 2 decimal places
    reviewCount
  });
}

module.exports = {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
  markReviewHelpful,
  getUserReviews
};
