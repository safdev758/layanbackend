const { AppDataSource } = require('./src/config/data-source');

async function createMarketplaceTables() {
  try {
    console.log('Starting marketplace tables creation...');
    
    await AppDataSource.initialize();
    console.log('✅ Database connection established');

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create marketplace_items table
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS marketplace_items (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "ownerId" UUID NOT NULL REFERENCES users(id),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          price NUMERIC(10,2) NOT NULL,
          images TEXT[] DEFAULT '{}',
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create threads table
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS threads (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "itemId" UUID NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
          "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "sellerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE("itemId", "userId", "sellerId")
        )
      `);

      // Create messages table
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          "threadId" UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
          "senderId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          "createdAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create indexes
      await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_marketplace_owner ON marketplace_items("ownerId")');
      await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_marketplace_created ON marketplace_items("createdAt")');
      await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_thread_item ON threads("itemId")');
      await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_thread_user ON threads("userId")');
      await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_thread_seller ON threads("sellerId")');
      await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_message_thread ON messages("threadId")');
      await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_message_sender ON messages("senderId")');
      await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_message_created ON messages("createdAt")');

      // Create full-text search index for marketplace items
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_marketplace_title_fulltext ON marketplace_items
        USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')))
      `);

      await queryRunner.commitTransaction();
      console.log('✅ Marketplace tables created successfully!');
      
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

  } catch (error) {
    console.error('❌ Failed to create marketplace tables:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run if executed directly
if (require.main === module) {
  createMarketplaceTables();
}

module.exports = { createMarketplaceTables };
