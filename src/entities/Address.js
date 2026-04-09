const { EntitySchema } = require("typeorm");

const Address = new EntitySchema({
  name: "Address",
  tableName: "addresses",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    userId: {
      type: "uuid",
    },
    title: {
      type: "varchar",
      length: 100,
      nullable: true,
    },
    street: {
      type: "varchar",
      length: 255,
    },
    city: {
      type: "varchar",
      length: 100,
    },
    state: {
      type: "varchar",
      length: 100,
    },
    zipCode: {
      type: "varchar",
      length: 20,
    },
    country: {
      type: "varchar",
      length: 100,
    },
    isDefault: {
      type: "boolean",
      default: false,
    },
    deliveryInstructions: {
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
  },
  relations: {
    user: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "userId" },
      onDelete: "CASCADE",
    },
  },
  indices: [
    {
      name: "IDX_ADDRESS_USER",
      columns: ["userId"],
    },
  ],
});

module.exports = { Address };
