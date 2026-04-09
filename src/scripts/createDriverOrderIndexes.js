const { AppDataSource } = require('../config/data-source');

const indexQueries = [
  `
  CREATE INDEX IF NOT EXISTS idx_orders_driver_active_updated_at
  ON orders ("driverId", "updatedAt" DESC)
  WHERE status IN ('PREPARING', 'OUT_FOR_DELIVERY');
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_orders_driver_created_at
  ON orders ("driverId", "createdAt" DESC);
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_driver_trips_driver_status_order
  ON driver_trips ("driverId", status, "orderId");
  `
];

async function run() {
  try {
    await AppDataSource.initialize();
    console.log('[Indexes] Connected');

    for (const query of indexQueries) {
      await AppDataSource.query(query);
    }

    console.log('[Indexes] Driver-order indexes ensured');
  } catch (error) {
    console.error('[Indexes] Failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

run();
