const { AppDataSource } = require('./src/config/data-source');

async function addSuspendedColumn() {
  try {
    console.log('🔧 Adding suspendedUntil column to users table...');
    
    // Initialize the data source
    await AppDataSource.initialize();
    console.log('✅ Database connection established');

    // Get the query runner
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Check if column exists
      const checkColumn = await queryRunner.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='users' AND column_name='suspendedUntil'
      `);

      if (checkColumn.length > 0) {
        console.log('ℹ️  Column suspendedUntil already exists');
      } else {
        // Add the suspendedUntil column
        await queryRunner.query(`
          ALTER TABLE users 
          ADD COLUMN "suspendedUntil" TIMESTAMPTZ
        `);
        console.log('✅ Column suspendedUntil added successfully!');
      }

      // Also ensure status column exists with proper constraints
      const checkStatus = await queryRunner.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='users' AND column_name='status'
      `);

      if (checkStatus.length === 0) {
        await queryRunner.query(`
          ALTER TABLE users 
          ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE' 
          CHECK (status IN ('PENDING','ACTIVE','SUSPENDED'))
        `);
        console.log('✅ Column status added successfully!');
      } else {
        console.log('ℹ️  Column status already exists');
      }

      console.log('✅ Migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Error during migration:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run migration
addSuspendedColumn();
