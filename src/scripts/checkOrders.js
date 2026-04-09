const { AppDataSource } = require('../config/data-source');
const { Order } = require('../entities/Order');

async function checkOrders() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected\n');

    const orderRepo = AppDataSource.getRepository(Order);
    
    // Get all CONFIRMED orders (available for drivers)
    const confirmedOrders = await orderRepo.find({
      where: { status: 'CONFIRMED', driverId: null },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' }
    });

    console.log('📦 CONFIRMED ORDERS (Available for Drivers)\n');
    console.log('='.repeat(70));
    
    if (confirmedOrders.length === 0) {
      console.log('\n⚠️  NO CONFIRMED ORDERS FOUND!');
      console.log('   Run: node src/scripts/addTestData.js to create test orders\n');
    } else {
      console.log(`\n✅ Found ${confirmedOrders.length} orders available for pickup:\n`);
      
      confirmedOrders.forEach((order, index) => {
        console.log(`${index + 1}. Order ID: ${order.id}`);
        console.log(`   Tracking: ${order.trackingNumber}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: $${order.totalAmount}`);
        console.log(`   Customer: ${order.userId}`);
        console.log(`   Store Location: ${order.storeLat ? `(${order.storeLat}, ${order.storeLon})` : 'NOT SET ❌'}`);
        console.log(`   Dest Location: ${order.destLat ? `(${order.destLat}, ${order.destLon})` : 'NOT SET ❌'}`);
        console.log(`   Delivery: ${order.deliveryAddress?.street || 'N/A'}, ${order.deliveryAddress?.city || 'N/A'}`);
        console.log(`   Items: ${order.items?.length || 0}`);
        console.log(`   Created: ${order.createdAt}`);
        console.log('');
      });
      
      console.log('='.repeat(70));
      console.log('\n💡 These orders should appear in the driver app!');
      console.log('   Make sure:');
      console.log('   1. You\'re logged in as a DRIVER role');
      console.log('   2. The app is calling GET /api/v1/drivers/{driverId}/available-deliveries');
      console.log('   3. Your driver location is within 10km radius\n');
    }

    // Also check if there are any orders with other statuses
    const allOrders = await orderRepo.count();
    const pending = await orderRepo.count({ where: { status: 'PENDING' } });
    const preparing = await orderRepo.count({ where: { status: 'PREPARING' } });
    const outForDelivery = await orderRepo.count({ where: { status: 'OUT_FOR_DELIVERY' } });
    const delivered = await orderRepo.count({ where: { status: 'DELIVERED' } });
    
    console.log('📊 Order Status Summary:');
    console.log(`   Total Orders: ${allOrders}`);
    console.log(`   PENDING: ${pending}`);
    console.log(`   CONFIRMED: ${confirmedOrders.length} ⭐ (Available for drivers)`);
    console.log(`   PREPARING: ${preparing}`);
    console.log(`   OUT_FOR_DELIVERY: ${outForDelivery}`);
    console.log(`   DELIVERED: ${delivered}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await AppDataSource.destroy();
  }
}

checkOrders();
