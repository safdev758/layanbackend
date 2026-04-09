const { AppDataSource } = require('./src/config/data-source');

async function migrateDatabase() {
  try {
    console.log('Starting database migration...');

    // Initialize the data source
    await AppDataSource.initialize();
    console.log('✅ Database connection established');

    // Get the query runner for manual migrations
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Drop existing tables if they exist (for clean migration)
      console.log('🧹 Cleaning existing tables...');

      const tables = [
        'messages', 'threads', 'marketplace_items', 'driver_trips',
        'order_items', 'orders', 'reviews', 'carts', 'products',
        'global_products', 'addresses', 'categories', 'users', 'app_settings'
      ];

      for (const table of tables) {
        await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      }

      // Create the database schema from scratch
      console.log('🏗️ Creating database schema...');

      // Enable UUID extension
      await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

      // Create app_settings table
      await queryRunner.query(`
        CREATE TABLE app_settings (
          key VARCHAR(100) PRIMARY KEY,
          value VARCHAR(255) NOT NULL,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create users table
      await queryRunner.query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          "passwordHash" VARCHAR(255),
          phone VARCHAR(20),
          "profileImage" VARCHAR(500),
          role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('CUSTOMER','SUPERMARKET','DRIVER','ADMIN')),
          preferences JSONB DEFAULT '{}'::jsonb,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED')),
          "suspendedUntil" TIMESTAMPTZ,
          "fcmToken" TEXT,
          "apnsToken" TEXT,
          "otpCode" VARCHAR(10),
          "otpExpiry" TIMESTAMP,
          phone_verified BOOLEAN DEFAULT FALSE,
          location_verified BOOLEAN DEFAULT FALSE,
          location_verification_token VARCHAR(255),
          location_verification_expiry TIMESTAMP,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create addresses table
      await queryRunner.query(`
        CREATE TABLE addresses (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(100),
          street VARCHAR(255) NOT NULL,
          city VARCHAR(100) NOT NULL,
          state VARCHAR(100) NOT NULL,
          "zipCode" VARCHAR(20) NOT NULL,
          country VARCHAR(100) NOT NULL,
          "isDefault" BOOLEAN DEFAULT FALSE,
          "deliveryInstructions" TEXT,
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          "createdAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create categories table
      await queryRunner.query(`
        CREATE TABLE categories (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(100) NOT NULL,
          emoji VARCHAR(10),
          color VARCHAR(7),
          description TEXT,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create global_products table
      await queryRunner.query(`
        CREATE TABLE global_products (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          image TEXT,
          "categoryId" UUID REFERENCES categories(id),
          brand VARCHAR(100),
          weight VARCHAR(50),
          "nutritionalInfo" JSONB,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create products table
      await queryRunner.query(`
        CREATE TABLE products (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "ownerId" UUID REFERENCES users(id),
          name VARCHAR(255) NOT NULL,
          price NUMERIC(10,2) NOT NULL,
          "originalPrice" NUMERIC(10,2),
          image VARCHAR(500),
          "categoryId" UUID REFERENCES categories(id),
          description TEXT,
          "isOnSale" BOOLEAN DEFAULT FALSE,
          rating NUMERIC(3,2) DEFAULT 0,
          "reviewCount" INTEGER DEFAULT 0,
          "inStock" BOOLEAN DEFAULT TRUE,
          "stockCount" INTEGER DEFAULT 0,
          images TEXT[] DEFAULT '{}',
          "nutritionalInfo" JSONB,
          brand VARCHAR(100),
          weight VARCHAR(50),
          "expiryDate" DATE,
          is_global BOOLEAN DEFAULT FALSE,
          global_product_id UUID,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create reviews table
      await queryRunner.query(`
        CREATE TABLE reviews (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "productId" UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          "userId" UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
          "userName" VARCHAR(255) NOT NULL,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          comment TEXT,
          helpful INTEGER DEFAULT 0,
          "createdAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create marketplace_items table
      await queryRunner.query(`
        CREATE TABLE marketplace_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          price NUMERIC(10,2) NOT NULL,
          images TEXT[] DEFAULT '{}',
          "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create threads table
      await queryRunner.query(`
        CREATE TABLE threads (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "itemId" UUID NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
          "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "sellerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE("itemId", "userId")
        )
      `);

      // Create messages table
      await queryRunner.query(`
        CREATE TABLE messages (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "threadId" UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
          "senderId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create orders table
      await queryRunner.query(`
        CREATE TABLE orders (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "userId" UUID NOT NULL REFERENCES users(id),
          "totalAmount" NUMERIC(12,2) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','PREPARING','OUT_FOR_DELIVERY','DELIVERED','CANCELLED')),
          "orderDate" TIMESTAMPTZ DEFAULT NOW(),
          "deliveryMethod" VARCHAR(20) DEFAULT 'DELIVERY',
          "deliveryDate" TIMESTAMPTZ,
          "paymentMethod" VARCHAR(50),
          "trackingNumber" VARCHAR(50),
          "driverId" UUID REFERENCES users(id),
          "driverLat" DOUBLE PRECISION,
          "driverLon" DOUBLE PRECISION,
          "storeLat" DOUBLE PRECISION,
          "storeLon" DOUBLE PRECISION,
          "destLat" DOUBLE PRECISION,
          "destLon" DOUBLE PRECISION,
          "deliveryAddress" JSONB NOT NULL,
          tip NUMERIC(10,2) DEFAULT 0,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create order_items table
      await queryRunner.query(`
        CREATE TABLE order_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "orderId" UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          "productId" UUID NOT NULL REFERENCES products(id),
          quantity INTEGER NOT NULL,
          "unitPrice" NUMERIC(10,2) NOT NULL,
          "selectedOptions" JSONB DEFAULT '{}'::jsonb
        )
      `);

      // Create carts table
      await queryRunner.query(`
        CREATE TABLE carts (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "userId" UUID NOT NULL UNIQUE REFERENCES users(id),
          items JSONB DEFAULT '[]'::jsonb,
          "totalAmount" NUMERIC(12,2) DEFAULT 0,
          "discountAmount" NUMERIC(12,2) DEFAULT 0,
          "deliveryFee" NUMERIC(10,2) DEFAULT 2.99,
          "finalAmount" NUMERIC(12,2) DEFAULT 0,
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create driver_trips table
      await queryRunner.query(`
        CREATE TABLE driver_trips (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "orderId" UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          "driverId" UUID NOT NULL REFERENCES users(id),
          status VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED','ACCEPTED','PICKED_UP','IN_TRANSIT','DELIVERED','CANCELLED')),
          "acceptedAt" TIMESTAMPTZ,
          "pickedUpAt" TIMESTAMPTZ,
          "deliveredAt" TIMESTAMPTZ,
          "lastLat" DOUBLE PRECISION,
          "lastLon" DOUBLE PRECISION,
          route JSONB,
          eta INTEGER,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_order_driver UNIQUE ("orderId")
        )
      `);

      // Create advertisements table
      await queryRunner.query(`
        CREATE TABLE advertisements (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "imageBase64" TEXT NOT NULL,
          description VARCHAR(500) NOT NULL,
          "isActive" BOOLEAN DEFAULT TRUE,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create indexes
      console.log('📊 Creating indexes...');

      await queryRunner.query('CREATE INDEX idx_users_role ON users(role)');
      await queryRunner.query('CREATE UNIQUE INDEX idx_users_email ON users(email)');
      await queryRunner.query('CREATE INDEX idx_users_status ON users(status)');
      await queryRunner.query('CREATE INDEX idx_users_location ON users(latitude, longitude)');
      await queryRunner.query('CREATE INDEX idx_addresses_user ON addresses("userId")');
      await queryRunner.query('CREATE INDEX idx_products_category ON products("categoryId")');
      await queryRunner.query('CREATE INDEX idx_products_store ON products("ownerId")');
      await queryRunner.query('CREATE INDEX idx_reviews_product ON reviews("productId")');
      await queryRunner.query('CREATE INDEX idx_orders_user ON orders("userId")');
      await queryRunner.query('CREATE INDEX idx_orders_status ON orders(status)');
      await queryRunner.query('CREATE INDEX idx_orders_driver ON orders("driverId")');
      await queryRunner.query('CREATE INDEX idx_order_items_order ON order_items("orderId")');
      await queryRunner.query('CREATE UNIQUE INDEX idx_carts_user ON carts("userId")');
      await queryRunner.query('CREATE INDEX idx_driver_trips_driver ON driver_trips("driverId")');
      await queryRunner.query('CREATE INDEX idx_marketplace_owner ON marketplace_items("ownerId")');
      await queryRunner.query('CREATE INDEX idx_thread_item ON threads("itemId")');
      await queryRunner.query('CREATE INDEX idx_thread_user ON threads("userId")');
      await queryRunner.query('CREATE INDEX idx_message_thread ON messages("threadId")');

      // Insert sample data
      console.log('🌱 Inserting sample data...');

      // Insert a default supermarket user for product ownership
      const userResult = await queryRunner.query(`
        INSERT INTO users (name, email, role, preferences) 
        VALUES ('Default Store', 'store@layan.com', 'SUPERMARKET', '{}'::jsonb)
        RETURNING id
      `);
      const storeUserId = userResult[0].id;
      console.log(`Created default store user with ID: ${storeUserId}`);

      // Insert default deactivation period (60 days)
      await queryRunner.query(`
        INSERT INTO app_settings (key, value) VALUES ('deactivationPeriodDays', '60')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `);

      // Insert categories
      await queryRunner.query(`
        INSERT INTO categories (name, emoji, color, description) VALUES
        ('Fruits & Vegetables', '🥬', '#4CAF50', 'Fresh fruits and vegetables'),
        ('Dairy & Eggs', '🥛', '#2196F3', 'Milk, cheese, eggs, and dairy products'),
        ('Meat & Seafood', '🥩', '#F44336', 'Fresh meat, poultry, and seafood'),
        ('Bakery', '🍞', '#FF9800', 'Fresh bread, pastries, and baked goods'),
        ('Pantry', '🥫', '#795548', 'Canned goods, pasta, rice, and pantry staples'),
        ('Beverages', '🥤', '#9C27B0', 'Drinks, juices, and beverages'),
        ('Snacks', '🍿', '#FF5722', 'Chips, crackers, and snack foods'),
        ('Frozen', '❄️', '#00BCD4', 'Frozen foods and ice cream')
      `);

      // Insert sample products (image column stores base64-encoded image data)
      await queryRunner.query(`
        INSERT INTO products (name, price, "originalPrice", image, "categoryId", description, "stockCount", brand, weight, "ownerId") VALUES
        ('Fresh Red Apples', 2.99, 3.99, '8J+Njg==', (SELECT id FROM categories WHERE name = 'Fruits & Vegetables'), 'Crisp and sweet red apples', 50, 'Fresh Farm', '1 lb', $1),
        ('Organic Bananas', 1.49, NULL, '8J+NjA==', (SELECT id FROM categories WHERE name = 'Fruits & Vegetables'), 'Organic bananas, perfect for snacking', 30, 'Organic Valley', '1 bunch', $1),
        ('Whole Milk', 3.49, NULL, '8J+lmw==', (SELECT id FROM categories WHERE name = 'Dairy & Eggs'), 'Fresh whole milk', 25, 'Dairy Fresh', '1 gallon', $1),
        ('Free Range Eggs', 4.99, NULL, '8J+lmg==', (SELECT id FROM categories WHERE name = 'Dairy & Eggs'), 'Farm-fresh free range eggs', 20, 'Happy Hens', '1 dozen', $1),
        ('Chicken Breast', 8.99, NULL, '8J+Nlw==', (SELECT id FROM categories WHERE name = 'Meat & Seafood'), 'Fresh chicken breast', 15, 'Premium Poultry', '1 lb', $1),
        ('Whole Wheat Bread', 2.49, NULL, '8J+Nng==', (SELECT id FROM categories WHERE name = 'Bakery'), 'Fresh whole wheat bread', 12, 'Artisan Bakery', '1 loaf', $1)
      `, [storeUserId]);

      await queryRunner.commitTransaction();
      console.log('✅ Database migration completed successfully!');

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateDatabase();
}

module.exports = { migrateDatabase };
