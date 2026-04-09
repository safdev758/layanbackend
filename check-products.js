const { AppDataSource } = require('./src/config/data-source');

async function check() {
  await AppDataSource.initialize();
  const res = await AppDataSource.query('SELECT id, name, price FROM products LIMIT 5');
  console.log(res);
  await AppDataSource.destroy();
}

check().catch(err => { console.error(err); process.exit(1); });
