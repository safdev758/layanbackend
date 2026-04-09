const { AppDataSource } = require('../config/data-source');
const { Order } = require('../entities/Order');
const { OrderItem } = require('../entities/OrderItem');
const { Product } = require('../entities/Product');

async function addMoreTestOrders() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected\n');

    const orderRepo = AppDataSource.getRepository(Order);
    const orderItemRepo = AppDataSource.getRepository(OrderItem);
    const productRepo = AppDataSource.getRepository(Product);

    // Get existing test data
    const customerId = '8b9b2dab-d782-49ed-94dd-9d601ab6be57';
    const supermarketId = '656a68b1-e49c-4dcd-8a9d-896182602889';
    
    // Get some products
    const products = await productRepo.find({
      where: { ownerId: supermarketId },
      take: 4
    });

    if (products.length === 0) {
      console.log('❌ No products found. Run addTestData.js first!');
      return;
    }

    console.log(`✅ Found ${products.length} products\n`);

    // Create 5 new orders
    const orderCount = 5;
    
    for (let i = 1; i <= orderCount; i++) {
      // Select 2 random products
      const orderProducts = [
        products[Math.floor(Math.random() * products.length)],
        products[Math.floor(Math.random() * products.length)]
      ];
      
      const totalAmount = orderProducts.reduce((sum, p) => sum + parseFloat(p.price), 0);

      const order = orderRepo.create({
        userId: customerId,
        totalAmount: totalAmount + 2.00, // Add delivery fee
        status: 'CONFIRMED', // Ready for drivers
        paymentMethod: 'CASH',
        tip: 1.00,
        storeLat: 36.8065,  // Tunis supermarket
        storeLon: 10.1815,
        storeId: supermarketId,
        destLat: 36.819,    // Customer location
        destLon: 10.1658,
        deliveryAddress: {
          title: 'Home',
          street: '15 Avenue Habib Bourguiba',
          city: 'Tunis',
          state: 'Tunis',
          zipCode: '1000',
          country: 'Tunisia',
          latitude: 36.819,
          longitude: 10.1658
        },
        trackingNumber: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        driverId: null // Available for pickup
      });

      const savedOrder = await orderRepo.save(order);
      console.log(`✅ Order ${i} created: ${savedOrder.trackingNumber} ($${savedOrder.totalAmount})`);

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
    }

    console.log(`\n🎉 Created ${orderCount} new CONFIRMED orders!`);
    console.log('✅ All orders are ready for driver pickup\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await AppDataSource.destroy();
  }
}

addMoreTestOrders();
