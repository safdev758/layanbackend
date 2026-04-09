const { AppDataSource } = require('./src/config/data-source');

async function addPhoneVerifiedColumn() {
  try {
    console.log('🔄 Connecting to database...');
    await AppDataSource.initialize();
    
    console.log('✅ Connected to database');
    console.log('🔄 Adding phone_verified column...');
    
    const queryRunner = AppDataSource.createQueryRunner();
    
    // Add column if it doesn't exist
    await queryRunner.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
    `);
    
    console.log('✅ Column added successfully');
    console.log('🔄 Updating existing users...');
    
    // Users without phone numbers are considered verified
    await queryRunner.query(`
      UPDATE users 
      SET phone_verified = true 
      WHERE phone IS NULL OR phone = '';
    `);
    
    // ADMIN users are always considered verified
    await queryRunner.query(`
      UPDATE users 
      SET phone_verified = true 
      WHERE role = 'ADMIN';
    `);
    
    console.log('✅ Updated existing users');
    console.log('🔄 Verifying changes...');
    
    // Verify the changes
    const result = await queryRunner.query(`
      SELECT id, name, email, phone, role, phone_verified, status 
      FROM users 
      ORDER BY "createdAt" DESC 
      LIMIT 10;
    `);
    
    console.log('\n📊 Sample users after migration:');
    console.table(result.map(u => ({
      name: u.name,
      email: u.email,
      phone: u.phone || 'N/A',
      role: u.role,
      phoneVerified: u.phone_verified,
      status: u.status
    })));
    
    await queryRunner.release();
    await AppDataSource.destroy();
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

addPhoneVerifiedColumn();
