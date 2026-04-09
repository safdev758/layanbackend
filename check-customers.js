const { AppDataSource } = require('./src/config/data-source');

async function checkCustomerUsers() {
  try {
    await AppDataSource.initialize();
    const res = await AppDataSource.query('SELECT email, role FROM users WHERE role = \'CUSTOMER\' LIMIT 3');
    console.log('Customer users:', res);
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkCustomerUsers();
