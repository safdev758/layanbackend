const { AppDataSource } = require('./src/config/data-source');

async function createAdvertisementsTable() {
  try {
    await AppDataSource.initialize();
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS advertisements (
        id UUID PRIMARY KEY,
        "imageBase64" TEXT NOT NULL,
        description VARCHAR(500) NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('advertisements table is ready.');
  } catch (error) {
    console.error('Failed to create advertisements table:', error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

createAdvertisementsTable();
