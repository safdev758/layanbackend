const { AppDataSource } = require('../config/data-source');

async function run() {
  try {
    await AppDataSource.initialize();
    console.log('[Migration] Connected');

    await AppDataSource.query(`
      ALTER TABLE store_profiles
      ALTER COLUMN "profileImage" TYPE TEXT;
    `);

    console.log('[Migration] store_profiles.profileImage widened to TEXT');
  } catch (error) {
    console.error('[Migration] Failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

run();
