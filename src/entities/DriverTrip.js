const { EntitySchema } = require("typeorm");

const DriverTrip = new EntitySchema({
  name: "DriverTrip",
  tableName: "driver_trips",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    orderId: {
      type: "uuid",
    },
    driverId: {
      type: "uuid",
    },
    status: {
      type: "varchar",
      length: 20,
      default: "ASSIGNED",
      enum: ["ASSIGNED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED"],
    },
    acceptedAt: {
      type: "timestamptz",
      nullable: true,
    },
    pickedUpAt: {
      type: "timestamptz",
      nullable: true,
    },
    deliveredAt: {
      type: "timestamptz",
      nullable: true,
    },
    lastLat: {
      type: "double precision",
      nullable: true,
    },
    lastLon: {
      type: "double precision",
      nullable: true,
    },
    route: {
      type: "jsonb",
      nullable: true,
    },
    eta: {
      type: "int",
      nullable: true,
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
    order: {
      target: "Order",
      type: "one-to-one",
      joinColumn: { name: "orderId" },
      onDelete: "CASCADE",
    },
    driver: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "driverId" },
    },
  },
  indices: [
    {
      name: "IDX_DRIVER_TRIPS_DRIVER",
      columns: ["driverId"],
    },
  ],
});

module.exports = { DriverTrip };
