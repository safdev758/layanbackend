const { AppDataSource } = require('../src/config/data-source');

(async ()=>{
  await AppDataSource.initialize();
  try {
    const cartRepo = AppDataSource.getRepository('Cart');
    const productRepo = AppDataSource.getRepository('Product');

    // Find any cart that contains 'Chicken Breast' product
    const carts = await cartRepo.find();
    for (const cart of carts) {
      for (const item of cart.items) {
        const p = await productRepo.findOne({ where: { id: item.productId } });
        if (p && p.name && p.name.toLowerCase().includes('chicken')) {
          console.log('Found cart', cart.id, 'with chicken item', item.quantity);
          // Run reconciliation snippet
          const adjustments = [];
          const newItems = [];
          for (const cartItem of cart.items) {
            const requestedQty = Number(cartItem.quantity) || 0;
            const product = await productRepo.findOne({ where: { id: cartItem.productId } });
            if (!product) { adjustments.push({ productId: cartItem.productId, action: 'removed', reason: 'product_not_found' }); continue; }
            const availableStock = Number(product.stockCount) || 0;
            if (!product.inStock || availableStock <= 0) { adjustments.push({ productId: product.id, name: product.name, action: 'removed', reason: 'out_of_stock' }); continue; }
            if (requestedQty > availableStock) { adjustments.push({ productId: product.id, name: product.name, action: 'reduced', from: requestedQty, to: availableStock }); newItems.push({ ...cartItem, quantity: availableStock }); }
            else if (requestedQty <= 0) { adjustments.push({ productId: product.id, name: product.name, action: 'removed', reason: 'invalid_quantity' }); }
            else { newItems.push({ ...cartItem, quantity: requestedQty }); }
          }
          console.log('Adjustments:', adjustments);
          return;
        }
      }
    }
    console.log('No carts with chicken found');
  } catch (err) { console.error(err); }
  await AppDataSource.destroy();
})();
