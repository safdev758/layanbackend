const { maintainDriverOrders } = require('./driverOrderMaintenanceService');

const DEFAULT_INTERVAL_MS = 60 * 1000;
const MIN_INTERVAL_MS = 15 * 1000;
const DEFAULT_BATCH_SIZE = 1000;

let cleanupTimer = null;
let cleanupRunning = false;

function getCleanupIntervalMs() {
  const configured = Number(process.env.DRIVER_ORDER_CLEANUP_INTERVAL_MS);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_INTERVAL_MS;
  }
  return Math.max(Math.floor(configured), MIN_INTERVAL_MS);
}

function getCleanupBatchSize() {
  const configured = Number(process.env.DRIVER_ORDER_CLEANUP_BATCH_SIZE);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(Math.floor(configured), 5000);
}

async function runCleanupTick() {
  if (cleanupRunning) {
    return;
  }

  cleanupRunning = true;
  try {
    const result = await maintainDriverOrders({ batchSize: getCleanupBatchSize() });
    if (result.reconciledDeliveredCount > 0 || result.cancelledExpiredCount > 0) {
      console.log(
        `[DriverOrderCleanup] reconciled=${result.reconciledDeliveredCount}, cancelled=${result.cancelledExpiredCount}`
      );
    }
  } catch (error) {
    console.error('[DriverOrderCleanup] tick failed:', error?.message || error);
  } finally {
    cleanupRunning = false;
  }
}

function startDriverOrderCleanupService() {
  if (cleanupTimer) {
    return;
  }

  const intervalMs = getCleanupIntervalMs();
  cleanupTimer = setInterval(() => {
    runCleanupTick();
  }, intervalMs);

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  runCleanupTick();
  console.log(`[DriverOrderCleanup] started (interval=${intervalMs}ms)`);
}

function stopDriverOrderCleanupService() {
  if (!cleanupTimer) {
    return;
  }

  clearInterval(cleanupTimer);
  cleanupTimer = null;
  console.log('[DriverOrderCleanup] stopped');
}

module.exports = {
  startDriverOrderCleanupService,
  stopDriverOrderCleanupService,
  runCleanupTick
};
