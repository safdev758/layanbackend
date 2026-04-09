const asyncHandler = require('../middleware/asyncHandler');
const { AppDataSource } = require('../config/data-source');
const { Cart } = require('../entities/Cart');
const { Product } = require('../entities/Product');

// Get current user's cart
const getCart = asyncHandler(async (req, res) => {
  const cartRepo = AppDataSource.getRepository(Cart);
  let cart = await cartRepo.findOne({
    where: { userId: req.user.id }
  });

  if (!cart) {
    // Create empty cart if it doesn't exist
    cart = cartRepo.create({
      userId: req.user.id,
      items: [],
      totalAmount: 0,
      discountAmount: 0,
      deliveryFee: 2.99,
      finalAmount: 2.99
    });
    cart = await cartRepo.save(cart);
  }

  // Calculate totals
  await calculateCartTotals(cart);
  await cartRepo.save(cart);

  res.json(cart);
});

// Add item to cart
const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1, selectedOptions = {} } = req.body;

  if (!productId) {
    return res.status(400).json({ message: 'Product ID is required' });
  }

  // Verify product exists and is in stock
  const productRepo = AppDataSource.getRepository(Product);
  const product = await productRepo.findOne({ where: { id: productId } });

  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }

  if (!product.inStock || product.stockCount < quantity) {
    return res.status(400).json({ message: 'Product not available in requested quantity' });
  }

  const cartRepo = AppDataSource.getRepository(Cart);
  let cart = await cartRepo.findOne({
    where: { userId: req.user.id }
  });

  if (!cart) {
    cart = cartRepo.create({
      userId: req.user.id,
      items: [],
      totalAmount: 0,
      discountAmount: 0,
      deliveryFee: 2.99,
      finalAmount: 2.99
    });
  }

  // Check if item already exists in cart
  const existingItemIndex = cart.items.findIndex(
    item => item.productId === productId && 
    JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions)
  );

  if (existingItemIndex >= 0) {
    // Update quantity of existing item
    cart.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    cart.items.push({
      productId,
      quantity,
      selectedOptions,
      unitPrice: Number(product.price),
      product: {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        emoji: product.emoji,
        images: product.images,
        inStock: product.inStock,
        stockCount: product.stockCount
      }
    });
  }

  // Calculate totals
  await calculateCartTotals(cart);
  sanitizeCartForSave(cart);
  const savedCart = await cartRepo.save(cart);

  res.json(savedCart);
});

// Update cart item quantity
const updateCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity, selectedOptions } = req.body;

  if (quantity !== undefined && quantity < 0) {
    return res.status(400).json({ message: 'Quantity cannot be negative' });
  }

  const cartRepo = AppDataSource.getRepository(Cart);
  const cart = await cartRepo.findOne({
    where: { userId: req.user.id }
  });

  if (!cart) {
    return res.status(404).json({ message: 'Cart not found' });
  }

  const itemIndex = cart.items.findIndex(
    item => item.productId === productId && 
    JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions || {})
  );

  if (itemIndex === -1) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  if (quantity === 0) {
    // Remove item
    cart.items.splice(itemIndex, 1);
  } else {
    // Update quantity
    cart.items[itemIndex].quantity = quantity;
  }

  // Calculate totals
  await calculateCartTotals(cart);
  sanitizeCartForSave(cart);
  const savedCart = await cartRepo.save(cart);

  res.json(savedCart);
});

// Remove item from cart
const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const cartRepo = AppDataSource.getRepository(Cart);
  const cart = await cartRepo.findOne({
    where: { userId: req.user.id }
  });

  if (!cart) {
    return res.status(404).json({ message: 'Cart not found' });
  }

  const itemIndex = cart.items.findIndex(item => item.productId === productId);

  if (itemIndex === -1) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  cart.items.splice(itemIndex, 1);

  // Calculate totals
  await calculateCartTotals(cart);
  sanitizeCartForSave(cart);
  const savedCart = await cartRepo.save(cart);

  res.json(savedCart);
});

// Clear cart
const clearCart = asyncHandler(async (req, res) => {
  const cartRepo = AppDataSource.getRepository(Cart);
  const cart = await cartRepo.findOne({
    where: { userId: req.user.id }
  });

  if (!cart) {
    return res.status(404).json({ message: 'Cart not found' });
  }

  cart.items = [];
  cart.totalAmount = 0;
  cart.discountAmount = 0;
  cart.finalAmount = 2.99; // Keep delivery fee

  sanitizeCartForSave(cart);
  const savedCart = await cartRepo.save(cart);
  res.json(savedCart);
});

// Helper function to calculate cart totals
async function calculateCartTotals(cart) {
  let totalAmount = 0;
  let discountAmount = 0;

  // Update product prices and calculate totals
  const productRepo = AppDataSource.getRepository(Product);
  
  for (let item of cart.items) {
    const product = await productRepo.findOne({ where: { id: item.productId } });
    if (product) {
      // Coerce numeric fields to numbers because TypeORM returns numeric as strings
      const price = Number(product.price);
      const originalPrice = product.originalPrice !== null && product.originalPrice !== undefined ? Number(product.originalPrice) : null;

      item.unitPrice = price;
      item.product = {
        id: product.id,
        name: product.name,
        price: price,
        originalPrice: originalPrice,
        emoji: product.emoji,
        images: product.images,
        inStock: product.inStock,
        stockCount: product.stockCount,
        isOnSale: product.isOnSale
      };

      const itemTotal = price * item.quantity;
      totalAmount += itemTotal;

      // Calculate discount if product is on sale
      if (originalPrice && originalPrice > price) {
        const itemDiscount = (originalPrice - price) * item.quantity;
        discountAmount += itemDiscount;
      }
    }
  }

  cart.totalAmount = totalAmount;
  cart.discountAmount = discountAmount;
  // Ensure deliveryFee is numeric (TypeORM may return numeric columns as strings)
  const deliveryFee = Number(cart.deliveryFee) || 0;
  cart.finalAmount = totalAmount + deliveryFee;

  return cart;
}

// Ensure numeric fields are numbers and items unitPrice are numbers before saving
function sanitizeCartForSave(cart) {
  if (!cart) return;
  cart.totalAmount = Number(cart.totalAmount) || 0;
  cart.discountAmount = Number(cart.discountAmount) || 0;
  cart.deliveryFee = Number(cart.deliveryFee) || 0;
  cart.finalAmount = Number(cart.finalAmount) || 0;
  if (Array.isArray(cart.items)) {
    cart.items = cart.items.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      selectedOptions: item.selectedOptions || {}
    }));
  }
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};
