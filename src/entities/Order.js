const { EntitySchema } = require("typeorm");

const Order = new EntitySchema({
  name: "Order",
  tableName: "orders",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    userId: {
      type: "uuid",
    },
    totalAmount: {
      type: "numeric",
      precision: 12,
      scale: 2,
    },
    status: {
      type: "varchar",
      length: 20,
      default: "PENDING",
      enum: ["PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
    },
    orderDate: {
      type: "timestamptz",
      default: () => "CURRENT_TIMESTAMP",
    },
    deliveryDate: {
      type: "timestamptz",
      nullable: true,
    },
    paymentMethod: {
      type: "varchar",
      length: 50,
      nullable: true,
    },
    trackingNumber: {
      type: "varchar",
      length: 50,
      nullable: true,
    },
    driverId: {
      type: "uuid",
      nullable: true,
    },
    driverLat: {
      type: "double precision",
      nullable: true,
    },
    driverLon: {
      type: "double precision",
      nullable: true,
    },
    storeLat: {
      type: "double precision",
      nullable: true,
    },
    storeLon: {
      type: "double precision",
      nullable: true,
    },
    destLat: {
      type: "double precision",
      nullable: true,
    },
    destLon: {
      type: "double precision",
      nullable: true,
    },
    deliveryAddress: {
      type: "jsonb",
    },
    tip: {
      type: "numeric",
      precision: 10,
      scale: 2,
      default: 0,
    },
    createdAt: {
      type: "timestamptz",
      default: () => "CURRENT_TIMESTAMP",
    },
    updatedAt: {
      type: "timestamptz",
      default: () => "CURRENT_TIMESTAMP",
      onUpdate: "CURRENT_TIMESTAMP",
    },
  },
  relations: {
    user: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "userId" },
    },
    driver: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "driverId" },
    },
    items: {
      target: "OrderItem",
      type: "one-to-many",
      inverseSide: "order",
      cascade: true,
    },
    driverTrip: {
      target: "DriverTrip",
      type: "one-to-one",
      inverseSide: "order",
      cascade: true,
    },
  },
  indices: [
    {
      name: "IDX_ORDER_USER",
      columns: ["userId"],
    },
    {
      name: "IDX_ORDER_STATUS",
      columns: ["status"],
    },
    {
      name: "IDX_ORDER_DRIVER",
      columns: ["driverId"],
    },
  ],
});

module.exports = { Order };
