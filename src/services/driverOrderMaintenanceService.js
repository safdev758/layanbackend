const { AppDataSource } = require('../config/data-source');
const { Order } = require('../entities/Order');
const { DriverTrip } = require('../entities/DriverTrip');

const ACTIVE_ORDER_STATUSES = ['PREPARING', 'OUT_FOR_DELIVERY'];
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 500;

function getHangingOrderTimeoutMs() {
  const configured = Number(process.env.DRIVER_ORDER_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return DEFAULT_TIMEOUT_MS;
}

function getHangingOrderCutoff(referenceTime = new Date()) {
  return new Date(referenceTime.getTime() - getHangingOrderTimeoutMs());
}

function parseBatchSize(batchSize) {
  const parsed = Number(batchSize);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(Math.floor(parsed), 5000);
}

async function findDeliveredTripActiveOrderIds(orderRepo, driverId, batchSize) {
  const qb = orderRepo
    .createQueryBuilder('order')
    .innerJoin(DriverTrip, 'trip', 'trip.orderId = order.id')
    .select('order.id', 'id')
    .where('order.status IN (:...activeStatuses)', {
      activeStatuses: ACTIVE_ORDER_STATUSES
    })
    .andWhere('trip.status = :tripDeliveredStatus', { tripDeliveredStatus: 'DELIVERED' })
    .orderBy('order.updatedAt', 'ASC')
    .limit(batchSize);

  if (driverId) {
    qb.andWhere('order.driverId = :driverId', { driverId });
  }

  const rows = await qb.getRawMany();
  return rows.map((row) => row.id).filter(Boolean);
}

async function findExpiredActiveOrderIds(orderRepo, driverId, cutoff, batchSize) {
  const qb = orderRepo
    .createQueryBuilder('order')
    .select('order.id', 'id')
    .where('order.status IN (:...activeStatuses)', {
      activeStatuses: ACTIVE_ORDER_STATUSES
    })
    .andWhere('order.driverId IS NOT NULL')
    .andWhere('order.updatedAt <= :cutoff', { cutoff })
    .orderBy('order.updatedAt', 'ASC')
    .limit(batchSize);

  if (driverId) {
    qb.andWhere('order.driverId = :driverId', { driverId });
  }

  const rows = await qb.getRawMany();
  return rows.map((row) => row.id).filter(Boolean);
}

async function maintainDriverOrders({ driverId = null, batchSize = DEFAULT_BATCH_SIZE } = {}) {
  const orderRepo = AppDataSource.getRepository(Order);
  const tripRepo = AppDataSource.getRepository(DriverTrip);
  const effectiveBatchSize = parseBatchSize(batchSize);

  const deliveredOrderIds = await findDeliveredTripActiveOrderIds(
    orderRepo,
    driverId,
    effectiveBatchSize
  );

  if (deliveredOrderIds.length > 0) {
    await orderRepo
      .createQueryBuilder()
      .update(Order)
      .set({
        status: 'DELIVERED',
        deliveryDate: () => 'COALESCE("deliveryDate", CURRENT_TIMESTAMP)'
      })
      .whereInIds(deliveredOrderIds)
      .execute();
  }

  const staleCutoff = getHangingOrderCutoff();
  const expiredOrderIds = await findExpiredActiveOrderIds(
    orderRepo,
    driverId,
    staleCutoff,
    effectiveBatchSize
  );

  if (expiredOrderIds.length > 0) {
    await orderRepo
      .createQueryBuilder()
      .update(Order)
      .set({ status: 'CANCELLED' })
      .whereInIds(expiredOrderIds)
      .execute();

    await tripRepo
      .createQueryBuilder()
      .update(DriverTrip)
      .set({ status: 'CANCELLED' })
      .where('orderId IN (:...orderIds)', { orderIds: expiredOrderIds })
      .andWhere('status != :deliveredStatus', { deliveredStatus: 'DELIVERED' })
      .execute();
  }

  return {
    reconciledDeliveredCount: deliveredOrderIds.length,
    cancelledExpiredCount: expiredOrderIds.length
  };
}

module.exports = {
  ACTIVE_ORDER_STATUSES,
  getHangingOrderCutoff,
  maintainDriverOrders
};
