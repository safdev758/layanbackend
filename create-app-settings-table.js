const { AppDataSource } = require('./src/config/data-source');

async function createAppSettingsTable() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected');

    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ app_settings table created');

    // Insert default setting
    await AppDataSource.query(`
      INSERT INTO app_settings (key, value)
      VALUES ('deactivationPeriodDays', '60')
      ON CONFLICT (key) DO NOTHING;
    `);

    console.log('✅ Default settings inserted');
    console.log('🎉 All done!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAppSettingsTable();
