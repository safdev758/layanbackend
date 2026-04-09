const { AppDataSource } = require('../config/data-source');
const { Product } = require('../entities/Product');

/**
 * Get all products with optional filtering
 * @param {Object} filters - Filter options
 * @param {string} filters.category - Filter by category
 * @param {boolean} filters.isActive - Filter by active status
 * @param {number} filters.limit - Limit number of results
 * @param {number} filters.offset - Offset for pagination
 * @returns {Promise<Array>} Array of products
 */
async function getAllProducts(filters = {}) {
  const repo = AppDataSource.getRepository(Product);
  
  const queryBuilder = repo.createQueryBuilder('product');
  
  // Apply filters
  if (filters.category) {
    queryBuilder.andWhere('product.category = :category', { category: filters.category });
  }
  
  if (filters.isActive !== undefined) {
    queryBuilder.andWhere('product.isActive = :isActive', { isActive: filters.isActive });
  } else {
    // By default, only show active products
    queryBuilder.andWhere('product.isActive = :isActive', { isActive: true });
  }
  
  // Apply pagination
  if (filters.limit) {
    queryBuilder.limit(filters.limit);
  }
  
  if (filters.offset) {
    queryBuilder.offset(filters.offset);
  }
  
  // Order by creation date (newest first)
  queryBuilder.orderBy('product.createdAt', 'DESC');
  
  const products = await queryBuilder.getMany();
  return products;
}

/**
 * Get product by ID
 * @param {number} id - Product ID
 * @returns {Promise<Object|null>} Product or null if not found
 */
async function getProductById(id) {
  const repo = AppDataSource.getRepository(Product);
  const product = await repo.findOne({ 
    where: { id, isActive: true } 
  });
  return product;
}

/**
 * Get products by category
 * @param {string} category - Category name
 * @returns {Promise<Array>} Array of products in the category
 */
async function getProductsByCategory(category) {
  const repo = AppDataSource.getRepository(Product);
  const products = await repo.find({
    where: { category, isActive: true },
    order: { createdAt: 'DESC' }
  });
  return products;
}

/**
 * Search products by name or description
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} Array of matching products
 */
async function searchProducts(searchTerm) {
  const repo = AppDataSource.getRepository(Product);
  const products = await repo
    .createQueryBuilder('product')
    .where('product.isActive = :isActive', { isActive: true })
    .andWhere(
      '(LOWER(product.name) LIKE LOWER(:searchTerm) OR LOWER(product.description) LIKE LOWER(:searchTerm))',
      { searchTerm: `%${searchTerm}%` }
    )
    .orderBy('product.createdAt', 'DESC')
    .getMany();
  
  return products;
}

/**
 * Get product statistics
 * @returns {Promise<Object>} Product statistics
 */
async function getProductStats() {
  const repo = AppDataSource.getRepository(Product);
  
  const totalProducts = await repo.count({ where: { isActive: true } });
  const totalCategories = await repo
    .createQueryBuilder('product')
    .select('COUNT(DISTINCT product.category)', 'count')
    .where('product.isActive = :isActive', { isActive: true })
    .getRawOne();
  
  const lowStockProducts = await repo.count({
    where: { isActive: true, stock: 5 } // Products with 5 or less in stock
  });
  
  return {
    totalProducts,
    totalCategories: parseInt(totalCategories.count),
    lowStockProducts
  };
}

module.exports = {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  searchProducts,
  getProductStats
};
