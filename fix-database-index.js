const { AppDataSource } = require('./src/config/data-source');

async function fixDatabaseIndex() {
    try {
        console.log('Connecting to database...');
        await AppDataSource.initialize();
        console.log('Database connected successfully');

        // Drop the invalid index if it exists
        const queryRunner = AppDataSource.createQueryRunner();
        
        try {
            console.log('Dropping invalid index IDX_PRODUCT_OWNER_ACTIVE...');
            await queryRunner.query(`DROP INDEX IF EXISTS "IDX_PRODUCT_OWNER_ACTIVE"`);
            console.log('✅ Invalid index dropped successfully');
        } catch (error) {
            console.log('Index may not exist or already dropped:', error.message);
        }

        // Check all existing indexes on products table
        console.log('\nChecking existing indexes on products table...');
        const indexes = await queryRunner.query(`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'products' 
            AND schemaname = 'public'
            ORDER BY indexname
        `);
        
        console.log('Existing indexes:');
        indexes.forEach(idx => {
            console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
        });

        await queryRunner.release();
        await AppDataSource.destroy();
        
        console.log('\n✅ Database index fix completed successfully!');
        console.log('You can now run: node server.js');
        
    } catch (error) {
        console.error('❌ Error fixing database index:', error);
        process.exit(1);
    }
}

fixDatabaseIndex();
