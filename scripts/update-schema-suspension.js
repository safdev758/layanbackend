const { AppDataSource } = require('../src/config/data-source');

(async () => {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      console.log('Altering users table: add column "suspendedUntil" if not exists');
      await qr.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS "suspendedUntil" TIMESTAMPTZ');

      console.log('Creating app_settings table if not exists');
      await qr.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key VARCHAR(100) PRIMARY KEY,
          value VARCHAR(255) NOT NULL,
          "createdAt" TIMESTAMPTZ DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      console.log('Upserting default deactivationPeriodDays = 60');
      await qr.query(`
        INSERT INTO app_settings (key, value) VALUES ('deactivationPeriodDays', '60')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `);

      await qr.commitTransaction();
      console.log('Schema update completed successfully.');
    } catch (e) {
      await qr.rollbackTransaction();
      console.error('Schema update failed:', e);
      process.exit(1);
    } finally {
      await qr.release();
      await AppDataSource.destroy();
    }
  } catch (e) {
    console.error('Failed to initialize data source:', e);
    process.exit(1);
  }
})();
