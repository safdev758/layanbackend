const { AppDataSource } = require('../config/data-source');
const { User } = require('../entities/User');
const { Product } = require('../entities/Product');
const { Order } = require('../entities/Order');
const { OrderItem } = require('../entities/OrderItem');
const { Address } = require('../entities/Address');
const { Category } = require('../entities/Category');
const bcrypt = require('bcryptjs');

async function addTestData() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    const userRepo = AppDataSource.getRepository(User);
    const productRepo = AppDataSource.getRepository(Product);
    const orderRepo = AppDataSource.getRepository(Order);
    const orderItemRepo = AppDataSource.getRepository(OrderItem);
    const addressRepo = AppDataSource.getRepository(Address);
    const categoryRepo = AppDataSource.getRepository(Category);

    // 0. Get or create a test category
    console.log('Getting or creating test category...');
    let category = await categoryRepo.findOne({ where: {} }); // Get any category
    if (!category) {
      category = categoryRepo.create({
        name: 'Groceries',
        icon: '🛒'
      });
      category = await categoryRepo.save(category);
      console.log('✅ Category created:', category.id);
    } else {
      console.log('✅ Using existing category:', category.id, '-', category.name);
    }

    // 1. Create test supermarket in Tunis
    console.log('Creating test supermarket...');
    const passwordHash = await bcrypt.hash('password123', 10);
    
    let supermarket = await userRepo.findOne({ where: { email: 'supermarket_test@example.com' } });
    if (!supermarket) {
      supermarket = userRepo.create({
        name: 'Test Supermarket Tunis',
        email: 'supermarket_test@example.com',
        passwordHash,
        role: 'SUPERMARKET',
        status: 'ACTIVE',
        latitude: 36.8065,  // Tunis coordinates
        longitude: 10.1815,
        locationVerified: true,
        preferences: { notifications: true, language: 'ar' }
      });
      supermarket = await userRepo.save(supermarket);
      console.log('✅ Supermarket created:', supermarket.id);
    } else {
      console.log('✅ Supermarket already exists:', supermarket.id);
    }

    // 2. Create test customer
    console.log('Creating test customer...');
    let customer = await userRepo.findOne({ where: { email: 'customer_test@example.com' } });
    if (!customer) {
      customer = userRepo.create({
        name: 'Test Customer',
        email: 'customer_test@example.com',
        passwordHash,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        preferences: { notifications: true, language: 'ar' }
      });
      customer = await userRepo.save(customer);
      console.log('✅ Customer created:', customer.id);
    } else {
      console.log('✅ Customer already exists:', customer.id);
    }

    // 3. Create customer delivery address
    console.log('Creating delivery address...');
    let address = await addressRepo.findOne({ where: { userId: customer.id } });
    if (!address) {
      address = addressRepo.create({
        userId: customer.id,
        title: 'Home',
        street: '15 Avenue Habib Bourguiba',
        city: 'Tunis',
        state: 'Tunis',
        zipCode: '1000',
        country: 'Tunisia',
        latitude: 36.8190,  // ~2km from supermarket
        longitude: 10.1658,
        isDefault: true
      });
      address = await addressRepo.save(address);
      console.log('✅ Address created:', address.id);
    } else {
      console.log('✅ Address already exists:', address.id);
    }

    // 4. Create test products
    console.log('Creating test products...');
    const products = [];
    const productData = [
      { name: 'Fresh Milk 1L', price: 2.50, category: 'Dairy' },
      { name: 'Whole Wheat Bread', price: 1.20, category: 'Bakery' },
      { name: 'Olive Oil 500ml', price: 8.50, category: 'Oil' },
      { name: 'Fresh Tomatoes 1kg', price: 3.00, category: 'Vegetables' }
    ];

    for (const data of productData) {
      let product = await productRepo.findOne({ 
        where: { name: data.name, ownerId: supermarket.id } 
      });
      
      if (!product) {
        product = productRepo.create({
          name: data.name,
          price: data.price,
          description: `Fresh ${data.name} from Test Supermarket`,
          ownerId: supermarket.id,
          categoryId: category.id, // Use actual category
          isGlobal: false,
          rating: 4.5,
          reviewCount: 10
        });
        product = await productRepo.save(product);
        console.log(`✅ Product created: ${product.name}`);
      } else {
        console.log(`✅ Product already exists: ${product.name}`);
      }
      products.push(product);
    }

    // 5. Create test orders (3 orders for testing)
    console.log('Creating test orders...');
    const orderCount = 3;
    
    for (let i = 1; i <= orderCount; i++) {
      const existingOrder = await orderRepo.findOne({
        where: { 
          userId: customer.id,
          trackingNumber: `TEST-ORDER-${i}`
        }
      });

      if (existingOrder) {
        console.log(`✅ Order ${i} already exists: ${existingOrder.id}`);
        continue;
      }

      // Create order with 2 random products
      const orderProducts = [products[i % products.length], products[(i + 1) % products.length]];
      const totalAmount = orderProducts.reduce((sum, p) => sum + parseFloat(p.price), 0);

      const order = orderRepo.create({
        userId: customer.id,
        totalAmount: totalAmount + 2.00, // Add delivery fee
        status: 'CONFIRMED', // Ready for drivers to pick up
        paymentMethod: 'CASH',
        tip: 1.00,
        storeLat: supermarket.latitude,
        storeLon: supermarket.longitude,
        storeId: supermarket.id,
        destLat: address.latitude,  // Customer destination latitude
        destLon: address.longitude,  // Customer destination longitude
        deliveryAddress: {
          title: address.title,
          street: address.street,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          country: address.country,
          latitude: address.latitude,
          longitude: address.longitude
        },
        trackingNumber: `TEST-ORDER-${i}`,
        driverId: null // Available for pickup
      });

      const savedOrder = await orderRepo.save(order);
      console.log(`✅ Order ${i} created: ${savedOrder.id} (${savedOrder.trackingNumber})`);

      // Create order items
      for (const product of orderProducts) {
        const orderItem = orderItemRepo.create({
          orderId: savedOrder.id,
          productId: product.id,
          quantity: 1,
          unitPrice: product.price
        });
        await orderItemRepo.save(orderItem);
      }
      console.log(`✅ Order items created for order ${i}`);
    }

    console.log('\n🎉 Test data added successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Supermarket: ${supermarket.email} (password: password123)`);
    console.log(`- Customer: ${customer.email} (password: password123)`);
    console.log(`- Products: ${products.length} items`);
    console.log(`- Orders: ${orderCount} confirmed orders ready for pickup`);
    console.log(`- Driver: a@example.com (your existing account)`);
    console.log('\n🚗 You can now:');
    console.log('1. Login as driver (a@example.com)');
    console.log('2. Check "Available Deliveries" in the driver dashboard');
    console.log('3. Accept an order and start delivery');
    console.log('\n💡 All orders are within 10km radius of your location in Tunis!');

  } catch (error) {
    console.error('❌ Error adding test data:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

addTestData();
