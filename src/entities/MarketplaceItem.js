const { EntitySchema } = require("typeorm");

const MarketplaceItem = new EntitySchema({
  name: "MarketplaceItem",
  tableName: "marketplace_items",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    title: {
      type: "varchar",
      length: 255,
    },
    description: {
      type: "text",
      nullable: true,
    },
    price: {
      type: "numeric",
      precision: 10,
      scale: 2,
    },
    images: {
      type: "text",
      array: true,
      default: [],
    },
    ownerId: {
      type: "uuid",
      nullable: false,
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
    owner: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "ownerId" },
      createForeignKeyConstraints: false,
    },
  },
  indices: [
    {
      name: "IDX_MARKETPLACE_OWNER",
      columns: ["ownerId"],
    },
  ],
});

module.exports = { MarketplaceItem };

