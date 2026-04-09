const { AppDataSource } = require('./src/config/data-source');

async function checkDrivers() {
  try {
    await AppDataSource.initialize();
    const drivers = await AppDataSource.query("SELECT email, role, name, id FROM users WHERE role='DRIVER' LIMIT 5");
    console.log('Drivers:', drivers);
    const customers = await AppDataSource.query("SELECT email, role, name, id FROM users WHERE role='CUSTOMER' LIMIT 5");
    console.log('Customers:', customers);
    const supermarkets = await AppDataSource.query("SELECT email, role, name, id FROM users WHERE role='SUPERMARKET' LIMIT 5");
    console.log('Supermarkets:', supermarkets);
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkDrivers();
