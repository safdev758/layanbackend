const { AppDataSource } = require('./src/config/data-source');
const bcrypt = require('bcryptjs');

async function updateAdminCredentials() {
  try {
    console.log('🔐 Updating admin credentials...');
    
    // Initialize the data source
    await AppDataSource.initialize();
    console.log('✅ Database connection established');

    // Get the query runner
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Set the new credentials
      const email = 'admin@layan.com';
      const password = 'Admin@123';  // Strong password
      
      // Hash the password
      const passwordHash = await bcrypt.hash(password, 10);

      // Check if admin user exists
      const existingAdmin = await queryRunner.query(`
        SELECT * FROM users WHERE email = $1
      `, [email]);

      if (existingAdmin.length > 0) {
        // Update existing admin
        await queryRunner.query(`
          UPDATE users 
          SET "passwordHash" = $1, 
              status = 'ACTIVE',
              role = 'ADMIN'
          WHERE email = $2
        `, [passwordHash, email]);
        console.log('✅ Admin credentials updated successfully!');
      } else {
        // Create new admin
        await queryRunner.query(`
          INSERT INTO users (name, email, "passwordHash", role, status, phone) 
          VALUES ($1, $2, $3, $4, $5, $6)
        `, ['Admin User', email, passwordHash, 'ADMIN', 'ACTIVE', '+1234567890']);
        console.log('✅ Admin user created successfully!');
      }

      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('📧 Email:    admin@layan.com');
      console.log('🔑 Password: Admin@123');
      console.log('═══════════════════════════════════════');
      console.log('');
      console.log('✨ You can now login to the dashboard!');
      console.log('🌐 Dashboard URL: http://localhost:4200');
      console.log('');
      
    } catch (error) {
      console.error('❌ Error updating credentials:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }

  } catch (error) {
    console.error('❌ Failed to update admin credentials:', error.message);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run
updateAdminCredentials();
