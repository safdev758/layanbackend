const { AppDataSource } = require('../config/data-source');
const { Order } = require('../entities/Order');
const { Address } = require('../entities/Address');

async function fixOrderLocations() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected\n');

    const orderRepo = AppDataSource.getRepository(Order);
    const addressRepo = AppDataSource.getRepository(Address);
    
    // Get all CONFIRMED orders without destination coordinates
    const ordersToFix = await orderRepo.find({
      where: { status: 'CONFIRMED' }
    });

    console.log(`📦 Found ${ordersToFix.length} CONFIRMED orders to check\n`);

    let fixed = 0;
    for (const order of ordersToFix) {
      if (!order.destLat || !order.destLon) {
        console.log(`Fixing order: ${order.trackingNumber}`);
        
        // Get customer's address
        const customerAddress = await addressRepo.findOne({
          where: { userId: order.userId, isDefault: true }
        });

        if (customerAddress && customerAddress.latitude && customerAddress.longitude) {
          await orderRepo.update(order.id, {
            destLat: customerAddress.latitude,
            destLon: customerAddress.longitude
          });
          
          console.log(`✅ Updated with destination: (${customerAddress.latitude}, ${customerAddress.longitude})`);
          fixed++;
        } else {
          // Use coordinates from deliveryAddress if available
          if (order.deliveryAddress) {
            // Default Tunis coordinates if not set
            const lat = 36.8190;
            const lon = 10.1658;
            
            await orderRepo.update(order.id, {
              destLat: lat,
              destLon: lon
            });
            
            console.log(`✅ Updated with default Tunis location: (${lat}, ${lon})`);
            fixed++;
          }
        }
      } else {
        console.log(`✓ Order ${order.trackingNumber} already has destination coordinates`);
      }
    }

    console.log(`\n🎉 Fixed ${fixed} orders!\n`);

    // Verify the fix
    const verifyOrders = await orderRepo.find({
      where: { status: 'CONFIRMED', driverId: null }
    });

    console.log('📋 Verification:');
    verifyOrders.forEach(order => {
      const hasStore = order.storeLat && order.storeLon;
      const hasDest = order.destLat && order.destLon;
      console.log(`   ${order.trackingNumber}: Store ${hasStore ? '✅' : '❌'} | Dest ${hasDest ? '✅' : '❌'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await AppDataSource.destroy();
  }
}

fixOrderLocations();
