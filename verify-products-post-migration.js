const { AppDataSource } = require('./src/config/data-source');

(async ()=>{
  try {
    await AppDataSource.initialize();
    const cols = await AppDataSource.query(`SELECT column_name FROM information_schema.columns WHERE table_name='products'`);
    console.log('columns:', cols.map(c=>c.column_name));
    const rows = await AppDataSource.query('SELECT id, name, image FROM products LIMIT 5');
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await AppDataSource.destroy();
  }
})();
