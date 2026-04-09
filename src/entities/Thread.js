const { EntitySchema } = require("typeorm");

const Thread = new EntitySchema({
  name: "Thread",
  tableName: "threads",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    itemId: {
      type: "uuid",
      nullable: false,
    },
    userId: {
      type: "uuid",
      nullable: false,
    },
    sellerId: {
      type: "uuid",
      nullable: false,
    },
    createdAt: {
      type: "timestamptz",
      default: () => "CURRENT_TIMESTAMP",
    },
  },
  relations: {
    item: {
      target: "MarketplaceItem",
      type: "many-to-one",
      joinColumn: { name: "itemId" },
    },
    user: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "userId" },
    },
    seller: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "sellerId" },
    },
  },
  indices: [
    {
      name: "IDX_THREAD_ITEM",
      columns: ["itemId"],
    },
    {
      name: "IDX_THREAD_USER",
      columns: ["userId"],
    },
    {
      name: "IDX_THREAD_ITEM_USER",
      columns: ["itemId", "userId"],
      unique: true,
    },
  ],
});

module.exports = { Thread };

