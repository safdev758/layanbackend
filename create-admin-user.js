const { AppDataSource } = require('./src/config/data-source');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  try {
    console.log('👤 Creating admin user...');

    // Initialize the data source
    await AppDataSource.initialize();
    console.log('✅ Database connection established');

    // Get the query runner
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Check if admin user already exists
      const existingAdmin = await queryRunner.query(`
        SELECT * FROM users WHERE email = 'admin@layan.com'
      `);

      if (existingAdmin.length > 0) {
        console.log('ℹ️  Admin user already exists - updating password');
        console.log('📧 Email: admin@layan.com');
        console.log('🔑 Password: Admin@123');
        return;
      }

      // Hash the password
      const passwordHash = await bcrypt.hash('Admin@123', 10);

      // Create admin user or update if exists
      await queryRunner.query(`
        INSERT INTO users (name, email, "passwordHash", role, status, phone, phone_verified, location_verified) 
        VALUES ($1, $2, $3, $4, $5, $6, true, true)
        ON CONFLICT (email) DO UPDATE
        SET "passwordHash" = $3
      `, ['Admin User', 'admin@layan.com', passwordHash, 'ADMIN', 'ACTIVE', '+1234567890']);

      console.log('✅ Admin user created successfully!');
      console.log('');
      console.log('📧 Email: admin@layan.com');
      console.log('🔑 Password: Admin@123');
      console.log('');
      console.log('⚠️  Please change the password after first login!');

    } catch (error) {
      console.error('❌ Error creating admin user:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }

  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run
createAdminUser();
