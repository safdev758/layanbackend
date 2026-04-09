const { AppDataSource } = require('./src/config/data-source');

async function checkUsers() {
  try {
    await AppDataSource.initialize();
    const res = await AppDataSource.query('SELECT email, role FROM users LIMIT 5');
    console.log('Users:', res);
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkUsers();
