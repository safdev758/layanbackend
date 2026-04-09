const { AppDataSource } = require('../src/config/data-source');

(async ()=>{
  await AppDataSource.initialize();
  try {
  const rows = await AppDataSource.query(`SELECT id, name, "inStock", "stockCount" FROM products WHERE name ILIKE '%chicken%'`);
    console.log(rows);
  } catch (err) { console.error(err); }
  await AppDataSource.destroy();
})();
