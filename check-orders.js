const { AppDataSource } = require('./src/config/data-source');
const { Order } = require('./src/entities/Order');

async function checkOrders() {
  try {
    await AppDataSource.initialize();
    const orderRepo = AppDataSource.getRepository(Order);
    const orders = await orderRepo.find({
      relations: ['items']
    });
    
    console.log('Total orders:', orders.length);
    orders.forEach(order => {
      console.log(`Order ${order.id}: Total=${order.totalAmount}, Items=${order.items.length}`);
    });
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkOrders();
