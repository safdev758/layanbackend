const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { Product } = require('../entities/Product');
const { Category } = require('../entities/Category');

// Global search across products and categories
const search = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ 
      message: 'Search query must be at least 2 characters long' 
    });
  }

  const searchTerm = q.trim();
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Search products
  const productRepo = AppDataSource.getRepository(Product);
  const productQuery = productRepo.createQueryBuilder('product')
    .leftJoinAndSelect('product.category', 'category')
    .where(
      '(product.name ILIKE :search OR product.description ILIKE :search OR product.brand ILIKE :search)',
      { search: `%${searchTerm}%` }
    )
    .orderBy('product.rating', 'DESC')
    .addOrderBy('product.reviewCount', 'DESC');

  // Search categories
  const categoryRepo = AppDataSource.getRepository(Category);
  const categoryQuery = categoryRepo.createQueryBuilder('category')
    .where(
      '(category.name ILIKE :search OR category.description ILIKE :search)',
      { search: `%${searchTerm}%` }
    )
    .orderBy('category.name', 'ASC');

  // Execute queries
  const [products, productTotal] = await productQuery.getManyAndCount();
  const [categories, categoryTotal] = await categoryQuery.getManyAndCount();

  // Apply pagination to products
  const paginatedProducts = products.slice(skip, skip + parseInt(limit));

  // Generate suggestions based on search term
  const suggestions = generateSearchSuggestions(searchTerm, products, categories);

  res.json({
    query: searchTerm,
    products: {
      items: paginatedProducts,
      total: productTotal,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(productTotal / parseInt(limit))
    },
    categories: {
      items: categories,
      total: categoryTotal
    },
    suggestions
  });
});

// Search products only
const searchProducts = asyncHandler(async (req, res) => {
  const { 
    q, 
    categoryId, 
    onSale, 
    sort = 'relevance', 
    page = 1, 
    limit = 20,
    minPrice,
    maxPrice,
    minRating
  } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ 
      message: 'Search query must be at least 2 characters long' 
    });
  }

  const searchTerm = q.trim();
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const repo = AppDataSource.getRepository(Product);
  let query = repo.createQueryBuilder('product')
    .leftJoinAndSelect('product.category', 'category');

  // Search in multiple fields
  query = query.where(
    '(product.name ILIKE :search OR product.description ILIKE :search OR product.brand ILIKE :search)',
    { search: `%${searchTerm}%` }
  );

  // Apply filters
  if (categoryId) {
    query = query.andWhere('product.categoryId = :categoryId', { categoryId });
  }

  if (onSale === 'true') {
    query = query.andWhere('product.isOnSale = :onSale', { onSale: true });
  }

  if (minPrice) {
    query = query.andWhere('product.price >= :minPrice', { minPrice: parseFloat(minPrice) });
  }

  if (maxPrice) {
    query = query.andWhere('product.price <= :maxPrice', { maxPrice: parseFloat(maxPrice) });
  }

  if (minRating) {
    query = query.andWhere('product.rating >= :minRating', { minRating: parseFloat(minRating) });
  }

  // Apply sorting
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
    case 'relevance':
    default:
      // Relevance sorting based on rating and review count
      query = query.orderBy('product.rating', 'DESC')
        .addOrderBy('product.reviewCount', 'DESC')
        .addOrderBy('product.name', 'ASC');
      break;
  }

  // Apply pagination
  query = query.skip(skip).take(parseInt(limit));

  const [products, total] = await query.getManyAndCount();

  // Calculate search stats
  const stats = {
    totalResults: total,
    searchTime: new Date().toISOString(),
    filters: {
      categoryId,
      onSale,
      minPrice,
      maxPrice,
      minRating
    }
  };

  res.json({
    query: searchTerm,
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    },
    stats
  });
});

// Get search suggestions
const getSearchSuggestions = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 1) {
    return res.json({ suggestions: [] });
  }

  const searchTerm = q.trim();

  // Get product name suggestions
  const productRepo = AppDataSource.getRepository(Product);
  const productSuggestions = await productRepo
    .createQueryBuilder('product')
    .select('product.name')
    .where('product.name ILIKE :search', { search: `%${searchTerm}%` })
    .groupBy('product.name')
    .orderBy('product.name', 'ASC')
    .limit(5)
    .getRawMany();

  // Get category suggestions
  const categoryRepo = AppDataSource.getRepository(Category);
  const categorySuggestions = await categoryRepo
    .createQueryBuilder('category')
    .select('category.name')
    .where('category.name ILIKE :search', { search: `%${searchTerm}%` })
    .orderBy('category.name', 'ASC')
    .limit(3)
    .getRawMany();

  // Get brand suggestions
  const brandSuggestions = await productRepo
    .createQueryBuilder('product')
    .select('product.brand')
    .where('product.brand ILIKE :search', { search: `%${searchTerm}%` })
    .andWhere('product.brand IS NOT NULL')
    .groupBy('product.brand')
    .orderBy('product.brand', 'ASC')
    .limit(3)
    .getRawMany();

  const suggestions = [
    ...productSuggestions.map(item => ({ type: 'product', text: item.product_name })),
    ...categorySuggestions.map(item => ({ type: 'category', text: item.category_name })),
    ...brandSuggestions.map(item => ({ type: 'brand', text: item.product_brand }))
  ];

  res.json({ suggestions });
});

// Get trending searches
const getTrendingSearches = asyncHandler(async (req, res) => {
  // This would typically come from analytics data
  // For now, we'll return some sample trending searches
  const trendingSearches = [
    'milk',
    'bread',
    'eggs',
    'bananas',
    'chicken',
    'rice',
    'apples',
    'vegetables',
    'cheese',
    'yogurt'
  ];

  res.json({ trending: trendingSearches });
});

// Advanced search with filters
const advancedSearch = asyncHandler(async (req, res) => {
  const {
    q,
    categories = [],
    brands = [],
    priceRange = {},
    rating = 0,
    onSale = false,
    inStock = true,
    sort = 'relevance',
    page = 1,
    limit = 20
  } = req.body;

  const searchTerm = q ? q.trim() : '';
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const repo = AppDataSource.getRepository(Product);
  let query = repo.createQueryBuilder('product')
    .leftJoinAndSelect('product.category', 'category');

  // Text search
  if (searchTerm) {
    query = query.where(
      '(product.name ILIKE :search OR product.description ILIKE :search OR product.brand ILIKE :search)',
      { search: `%${searchTerm}%` }
    );
  }

  // Category filter
  if (categories.length > 0) {
    const whereClause = searchTerm ? 'andWhere' : 'where';
    query = query[whereClause]('product.categoryId IN (:...categories)', { categories });
  }

  // Brand filter
  if (brands.length > 0) {
    const whereClause = searchTerm || categories.length > 0 ? 'andWhere' : 'where';
    query = query[whereClause]('product.brand IN (:...brands)', { brands });
  }

  // Price range filter
  if (priceRange.min !== undefined) {
    const whereClause = searchTerm || categories.length > 0 || brands.length > 0 ? 'andWhere' : 'where';
    query = query[whereClause]('product.price >= :minPrice', { minPrice: priceRange.min });
  }
  if (priceRange.max !== undefined) {
    const whereClause = searchTerm || categories.length > 0 || brands.length > 0 || priceRange.min !== undefined ? 'andWhere' : 'where';
    query = query[whereClause]('product.price <= :maxPrice', { maxPrice: priceRange.max });
  }

  // Rating filter
  if (rating > 0) {
    const whereClause = searchTerm || categories.length > 0 || brands.length > 0 || priceRange.min !== undefined || priceRange.max !== undefined ? 'andWhere' : 'where';
    query = query[whereClause]('product.rating >= :rating', { rating });
  }

  // On sale filter
  if (onSale) {
    const whereClause = searchTerm || categories.length > 0 || brands.length > 0 || priceRange.min !== undefined || priceRange.max !== undefined || rating > 0 ? 'andWhere' : 'where';
    query = query[whereClause]('product.isOnSale = :onSale', { onSale: true });
  }

  // In stock filter
  if (inStock) {
    const whereClause = searchTerm || categories.length > 0 || brands.length > 0 || priceRange.min !== undefined || priceRange.max !== undefined || rating > 0 || onSale ? 'andWhere' : 'where';
    query = query[whereClause]('product.inStock = :inStock', { inStock: true });
  }

  // Apply sorting
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
    case 'relevance':
    default:
      query = query.orderBy('product.rating', 'DESC')
        .addOrderBy('product.reviewCount', 'DESC')
        .addOrderBy('product.name', 'ASC');
      break;
  }

  // Apply pagination
  query = query.skip(skip).take(parseInt(limit));

  const [products, total] = await query.getManyAndCount();

  res.json({
    query: searchTerm,
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    },
    filters: {
      categories,
      brands,
      priceRange,
      rating,
      onSale,
      inStock
    }
  });
});

// Helper function to generate search suggestions
function generateSearchSuggestions(searchTerm, products, categories) {
  const suggestions = [];
  
  // Add popular products from results
  const popularProducts = products
    .filter(p => p.rating >= 4)
    .slice(0, 3)
    .map(p => ({ type: 'product', text: p.name }));

  // Add categories from results
  const categorySuggestions = categories
    .slice(0, 2)
    .map(c => ({ type: 'category', text: c.name }));

  suggestions.push(...popularProducts, ...categorySuggestions);

  return suggestions;
}

module.exports = {
  search,
  searchProducts,
  getSearchSuggestions,
  getTrendingSearches,
  advancedSearch
};
