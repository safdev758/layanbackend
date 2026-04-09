const { AppDataSource } = require('./src/config/data-source');
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...');
        await AppDataSource.initialize();
        console.log('✅ Connected to database');

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // 1. Get Categories
            const categories = await queryRunner.query('SELECT id, name FROM categories');
            console.log(`Found ${categories.length} categories`);

            const passwordHash = await bcrypt.hash('password123', 10);

            // 2. Create Supermarkets (10)
            console.log('🛒 Creating supermarkets...');
            const supermarketIds = [];
            for (let i = 0; i < 10; i++) {
                const result = await queryRunner.query(`
          INSERT INTO users (name, email, "passwordHash", role, phone, latitude, longitude, status, phone_verified, location_verified)
          VALUES ($1, $2, $3, 'SUPERMARKET', $4, $5, $6, 'ACTIVE', true, true)
          RETURNING id
        `, [
                    faker.company.name(),
                    faker.internet.email().toLowerCase(),
                    passwordHash,
                    faker.phone.number().slice(0, 20),
                    faker.location.latitude(),
                    faker.location.longitude()
                ]);
                supermarketIds.push(result[0].id);
            }

            // 3. Create Drivers (5)
            console.log('🚚 Creating drivers...');
            const driverIds = [];
            for (let i = 0; i < 5; i++) {
                const result = await queryRunner.query(`
          INSERT INTO users (name, email, "passwordHash", role, phone, latitude, longitude, status, phone_verified, location_verified)
          VALUES ($1, $2, $3, 'DRIVER', $4, $5, $6, 'ACTIVE', true, true)
          RETURNING id
        `, [
                    faker.person.fullName(),
                    faker.internet.email().toLowerCase(),
                    passwordHash,
                    faker.phone.number().slice(0, 20),
                    faker.location.latitude(),
                    faker.location.longitude()
                ]);
                driverIds.push(result[0].id);
            }

            // 4. Create Customers (15)
            console.log('👥 Creating customers...');
            const customerIds = [];
            for (let i = 0; i < 15; i++) {
                const result = await queryRunner.query(`
          INSERT INTO users (name, email, "passwordHash", role, phone, latitude, longitude, status, phone_verified, location_verified)
          VALUES ($1, $2, $3, 'CUSTOMER', $4, $5, $6, 'ACTIVE', true, true)
          RETURNING id
        `, [
                    faker.person.fullName(),
                    faker.internet.email().toLowerCase(),
                    passwordHash,
                    faker.phone.number().slice(0, 20),
                    faker.location.latitude(),
                    faker.location.longitude()
                ]);
                customerIds.push(result[0].id);
            }

            // 5. Create Global Products (30)
            console.log('🌍 Creating global products...');
            const globalProductIds = [];
            const globalProductData = [
                { name: 'Fresh Milk 1L', brand: 'Layan Fresh', weight: '1L', category: 'Dairy' },
                { name: 'Whole Wheat Bread', brand: 'Bakery Choice', weight: '500g', category: 'Bakery' },
                { name: 'Organic Bananas', brand: 'Nature First', weight: '1kg', category: 'Fruits' },
                { name: 'Red Apples', brand: 'Orchard Fresh', weight: '1kg', category: 'Fruits' },
                { name: 'Cheddar Cheese', brand: 'Dairy Gold', weight: '200g', category: 'Dairy' },
                { name: 'Chicken Breast', brand: 'Farm Select', weight: '500g', category: 'Meat' },
                { name: 'Ground Beef', brand: 'Farm Select', weight: '500g', category: 'Meat' },
                { name: 'Pasta Spaghetti', brand: 'Italian Style', weight: '500g', category: 'Pantry' },
                { name: 'Olive Oil', brand: 'Mediterranean', weight: '750ml', category: 'Pantry' },
                { name: 'Coffee Beans', brand: 'Roast Master', weight: '250g', category: 'Beverages' }
            ];

            for (let i = 0; i < 30; i++) {
                const template = globalProductData[i % globalProductData.length];
                const category = categories.find(c => c.name.includes(template.category)) || categories[0];
                const result = await queryRunner.query(`
                    INSERT INTO global_products (name, brand, weight, "categoryId", description, image)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `, [
                    i < 10 ? template.name : faker.commerce.productName(),
                    i < 10 ? template.brand : faker.company.name(),
                    i < 10 ? template.weight : faker.number.int({ min: 100, max: 1000 }) + 'g',
                    category.id,
                    faker.commerce.productDescription(),
                    `https://picsum.photos/seed/${faker.string.uuid()}/400/400`
                ]);
                globalProductIds.push(result[0].id);
            }

            // 6. Create Products (50) - some linked to global
            console.log('📦 Creating products...');
            const productIds = [];
            for (let i = 0; i < 50; i++) {
                const price = parseFloat(faker.commerce.price({ min: 1, max: 100 }));
                const isGlobal = faker.datatype.boolean(0.4);
                const globalProduct = isGlobal ? faker.helpers.arrayElement(globalProductIds) : null;

                const result = await queryRunner.query(`
          INSERT INTO products (name, price, "originalPrice", "ownerId", "categoryId", description, "stockCount", brand, weight, rating, "reviewCount", is_global, global_product_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id
        `, [
                    faker.commerce.productName(),
                    price,
                    faker.helpers.maybe(() => price * 1.2, { probability: 0.3 }),
                    faker.helpers.arrayElement(supermarketIds),
                    faker.helpers.arrayElement(categories).id,
                    faker.commerce.productDescription(),
                    faker.number.int({ min: 10, max: 100 }),
                    faker.company.name(),
                    faker.number.int({ min: 100, max: 1000 }) + 'g',
                    faker.number.float({ min: 3, max: 5, fractionDigits: 1 }),
                    faker.number.int({ min: 0, max: 50 }),
                    isGlobal,
                    globalProduct
                ]);
                productIds.push(result[0].id);
            }

            // 7. Create Orders (40) - distributed over last 30 days
            console.log('🧾 Creating orders...');
            for (let i = 0; i < 40; i++) {
                const customerId = faker.helpers.arrayElement(customerIds);
                const orderStatus = faker.helpers.arrayElement(['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']);
                // Distribute orders more heavily towards the last few days
                const orderDate = faker.date.recent({ days: 30 });
                const driverId = orderStatus === 'DELIVERED' || orderStatus === 'OUT_FOR_DELIVERY' ? faker.helpers.arrayElement(driverIds) : null;

                const orderResult = await queryRunner.query(`
          INSERT INTO orders ("userId", "totalAmount", status, "orderDate", "deliveryMethod", "paymentMethod", "deliveryAddress", "driverId")
          VALUES ($1, $2, $3, $4, 'DELIVERY', 'CARD', $5, $6)
          RETURNING id
        `, [
                    customerId,
                    0, // Calculated later
                    orderStatus,
                    orderDate,
                    JSON.stringify({
                        street: faker.location.streetAddress(),
                        city: faker.location.city(),
                        state: faker.location.state(),
                        zipCode: faker.location.zipCode(),
                        country: 'USA'
                    }),
                    driverId
                ]);
                const orderId = orderResult[0].id;

                // Create Order Items (1-5 per order)
                let totalAmount = 0;
                const itemCount = faker.number.int({ min: 1, max: 5 });
                for (let j = 0; j < itemCount; j++) {
                    const productId = faker.helpers.arrayElement(productIds);
                    const product = await queryRunner.query('SELECT price FROM products WHERE id = $1', [productId]);
                    const quantity = faker.number.int({ min: 1, max: 3 });
                    const unitPrice = parseFloat(product[0].price);
                    totalAmount += unitPrice * quantity;

                    await queryRunner.query(`
            INSERT INTO order_items ("orderId", "productId", quantity, "unitPrice")
            VALUES ($1, $2, $3, $4)
          `, [orderId, productId, quantity, unitPrice]);
                }

                // Update Order Total
                await queryRunner.query('UPDATE orders SET "totalAmount" = $1 WHERE id = $2', [totalAmount, orderId]);
            }

            // 8. Create Reviews
            console.log('⭐️ Creating reviews...');
            for (let i = 0; i < 30; i++) {
                const productId = faker.helpers.arrayElement(productIds);
                const userId = faker.helpers.arrayElement(customerIds);
                const user = await queryRunner.query('SELECT name FROM users WHERE id = $1', [userId]);

                await queryRunner.query(`
          INSERT INTO reviews ("productId", "userId", "userName", rating, comment, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
                    productId,
                    userId,
                    user[0].name,
                    faker.number.int({ min: 1, max: 5 }),
                    faker.lorem.paragraph(),
                    faker.date.recent({ days: 30 })
                ]);
            }

            await queryRunner.commitTransaction();
            console.log('✅ Database seeding completed successfully!');
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await AppDataSource.destroy();
    }
}

seedDatabase();
