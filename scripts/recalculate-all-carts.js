const { AppDataSource } = require('../src/config/data-source');
const { Cart } = require('../src/entities/Cart');
const { Product } = require('../src/entities/Product');

(async ()=>{
  try {
    await AppDataSource.initialize();
    const cartRepo = AppDataSource.getRepository(Cart);
    const productRepo = AppDataSource.getRepository(Product);

    const carts = await cartRepo.find();
    console.log('Found', carts.length, 'carts');
    for (const cart of carts) {
      let totalAmount = 0;
      let discountAmount = 0;
      for (let item of cart.items) {
        const product = await productRepo.findOne({ where: { id: item.productId } });
        if (!product) continue;
        const price = Number(product.price);
        const originalPrice = product.originalPrice ? Number(product.originalPrice) : null;
        item.unitPrice = price;
        item.product = { id: product.id, name: product.name, price, originalPrice };
        totalAmount += price * item.quantity;
        if (originalPrice && originalPrice > price) discountAmount += (originalPrice - price) * item.quantity;
      }
      cart.totalAmount = totalAmount;
      cart.discountAmount = discountAmount;
      cart.finalAmount = totalAmount + Number(cart.deliveryFee || 0);
      await cartRepo.save(cart);
      console.log('Updated cart', cart.id);
    }

    console.log('Done');
  } catch (err) {
    console.error(err);
  } finally {
    await AppDataSource.destroy();
  }
})();
