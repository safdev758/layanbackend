const { EntitySchema } = require("typeorm");

const StoreProfile = new EntitySchema({
  name: "StoreProfile",
  tableName: "store_profiles",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    userId: {
      type: "uuid",
      unique: true,
      nullable: false,
    },
    displayName: {
      type: "varchar",
      length: 255,
    },
    phone: {
      type: "varchar",
      length: 20,
      nullable: true,
    },
    profileImage: {
      type: "text",
      nullable: true,
    },
    images: {
      type: "text",
      array: true,
      default: [],
    },
    description: {
      type: "text",
      nullable: true,
    },
    latitude: {
      type: "double precision",
      nullable: true,
    },
    longitude: {
      type: "double precision",
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
    user: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "userId" },
      createForeignKeyConstraints: false,
    },
  },
  indices: [
    {
      name: "IDX_STORE_PROFILE_USER",
      columns: ["userId"],
      unique: true,
    },
    {
      name: "IDX_STORE_PROFILE_NAME",
      columns: ["displayName"],
    },
  ],
});

module.exports = { StoreProfile };
