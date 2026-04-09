const { AppDataSource } = require('../config/data-source');
const { Product } = require('../entities/Product');
const { User } = require('../entities/User');
const fs = require('fs');

const sampleProducts = [
  {
    name: "Fresh Apples",
    description: "Crispy red apples, perfect for snacking",
    price: 2.99,
    category: "Fruits",
    imageUrl: "https://example.com/images/apples.jpg",
    stock: 50,
    isActive: true
  },
  {
    name: "Organic Bananas",
    description: "Sweet organic bananas, rich in potassium",
    price: 1.99,
    category: "Fruits",
    imageUrl: "https://example.com/images/bananas.jpg",
    stock: 30,
    isActive: true
  },
  {
    name: "Fresh Milk",
    description: "Farm fresh whole milk, 1 liter",
    price: 3.49,
    category: "Dairy",
    imageUrl: "https://example.com/images/milk.jpg",
    stock: 25,
    isActive: true
  },
  {
    name: "Whole Wheat Bread",
    description: "Freshly baked whole wheat bread",
    price: 2.79,
    category: "Bakery",
    imageUrl: "https://example.com/images/bread.jpg",
    stock: 15,
    isActive: true
  },
  {
    name: "Greek Yogurt",
    description: "Creamy Greek yogurt, high in protein",
    price: 4.99,
    category: "Dairy",
    imageUrl: "https://example.com/images/yogurt.jpg",
    stock: 20,
    isActive: true
  },
  {
    name: "Fresh Carrots",
    description: "Organic carrots, perfect for cooking",
    price: 1.49,
    category: "Vegetables",
    imageUrl: "https://example.com/images/carrots.jpg",
    stock: 40,
    isActive: true
  },
  {
    name: "Chicken Breast",
    description: "Fresh chicken breast, boneless",
    price: 8.99,
    category: "Meat",
    imageUrl: "https://example.com/images/chicken.jpg",
    stock: 12,
    isActive: true
  },
  {
    name: "Orange Juice",
    description: "Fresh squeezed orange juice, 1 liter",
    price: 4.49,
    category: "Beverages",
    imageUrl: "https://example.com/images/orange-juice.jpg",
    stock: 18,
    isActive: true
  }
];

// Helper function to convert image URLs to base64
async function convertImageToBase64(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

(async () => {
  for (const product of sampleProducts) {
    try {
      const base64Image = await convertImageToBase64(product.imageUrl);
      product.image = base64Image; // Replace imageUrl with base64-encoded image
      delete product.imageUrl; // Remove the imageUrl field
    } catch (error) {
      console.error(`Failed to convert image for product: ${product.name}`, error);
    }
  }

  console.log('All product images converted to base64.');
})();

async function seedProducts() {
  try {
    await AppDataSource.initialize();
    console.log('Data Source has been initialized for seeding.');
    
    const productRepo = AppDataSource.getRepository(Product);
    const userRepo = AppDataSource.getRepository(User);
    
    // Check if products already exist
    const existingProducts = await productRepo.count();
    if (existingProducts > 0) {
      console.log('Products already exist. Skipping seed.');
      return;
    }
    
    // Get or create a default supermarket user
    let storeUser = await userRepo.findOne({ where: { role: 'SUPERMARKET' } });
    if (!storeUser) {
      console.log('Creating default supermarket user...');
      storeUser = userRepo.create({
        name: 'Default Store',
        email: `store-${Date.now()}@layan.com`,
        role: 'SUPERMARKET',
        preferences: {}
      });
      storeUser = await userRepo.save(storeUser);
      console.log(`Created store user with ID: ${storeUser.id}`);
    }
    
    // Insert sample products with ownerId
    for (const productData of sampleProducts) {
      const product = productRepo.create({
        ...productData,
        ownerId: storeUser.id
      });
      await productRepo.save(product);
      console.log(`Created product: ${product.name}`);
    }
    
    console.log('✅ Product seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during product seeding:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedProducts();
}

module.exports = { seedProducts, sampleProducts };
