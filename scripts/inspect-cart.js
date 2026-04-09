const { AppDataSource } = require('../src/config/data-source');

(async ()=>{
  try {
    await AppDataSource.initialize();
    const cartId = '4358c5b0-d206-4b2a-8b42-6cc01f6d7147';
    const res = await AppDataSource.query(`SELECT id, items, totalAmount::text AS total_text, pg_typeof(totalAmount) AS total_type, deliveryFee::text AS delivery_text, pg_typeof(deliveryFee) AS delivery_type, finalAmount::text AS final_text, pg_typeof(finalAmount) AS final_type FROM carts WHERE id = $1`, [cartId]);
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await AppDataSource.destroy();
  }
})();
