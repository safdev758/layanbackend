const { EntitySchema } = require("typeorm");

const User = new EntitySchema({
  name: "User",
  tableName: "users",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    name: {
      type: "varchar",
      length: 255,
    },
    email: {
      type: "varchar",
      unique: true,
      length: 255,
    },
    passwordHash: {
      type: "varchar",
      length: 255,
      nullable: true,
    },
    phone: {
      type: "varchar",
      length: 20,
      nullable: true,
    },
    profileImage: {
      type: "varchar",
      length: 500,
      nullable: true,
    },
    role: {
      type: "varchar",
      length: 20,
      default: "CUSTOMER",
      enum: ["CUSTOMER", "SUPERMARKET", "DRIVER", "ADMIN"],
    },
    preferences: {
      type: "jsonb",
      default: {},
    },
    latitude: {
      type: "double precision",
      nullable: true,
    },
    longitude: {
      type: "double precision",
      nullable: true,
    },
    status: {
      type: "varchar",
      length: 20,
      default: "ACTIVE",
      enum: ["PENDING", "ACTIVE", "SUSPENDED"],
    },
    suspendedUntil: {
      type: "timestamptz",
      nullable: true,
    },
    fcmToken: {
      type: "text",
      nullable: true,
    },
    apnsToken: {
      type: "text",
      nullable: true,
    },
    otpCode: {
      type: "varchar",
      nullable: true,
    },
    otpExpiry: {
      type: "timestamp",
      nullable: true,
    },
    phoneVerified: {
      name: "phone_verified",
      type: "boolean",
      default: false,
    },
    locationVerified: {
      name: "location_verified",
      type: "boolean",
      default: false,
    },
    locationVerificationToken: {
      name: "location_verification_token",
      type: "varchar",
      nullable: true,
    },
    locationVerificationExpiry: {
      name: "location_verification_expiry",
      type: "timestamp",
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
    addresses: {
      target: "Address",
      type: "one-to-many",
      inverseSide: "user",
      cascade: true,
    },
    reviews: {
      target: "Review",
      type: "one-to-many",
      inverseSide: "user",
    },
    orders: {
      target: "Order",
      type: "one-to-many",
      inverseSide: "user",
    },
    driverTrips: {
      target: "DriverTrip",
      type: "one-to-many",
      inverseSide: "driver",
    },
    cart: {
      target: "Cart",
      type: "one-to-one",
      inverseSide: "user",
      cascade: true,
    },
  },
  indices: [
    {
      name: "IDX_USER_ROLE",
      columns: ["role"],
    },
    {
      name: "IDX_USER_EMAIL",
      columns: ["email"],
      unique: true,
    },
  ],
});

module.exports = { User };
