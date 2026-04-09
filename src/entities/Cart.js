const { EntitySchema } = require("typeorm");

const Cart = new EntitySchema({
  name: "Cart",
  tableName: "carts",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    userId: {
      type: "uuid",
      unique: true,
    },
    items: {
      type: "jsonb",
      default: [],
    },
    totalAmount: {
      type: "numeric",
      precision: 12,
      scale: 2,
      default: 0,
    },
    discountAmount: {
      type: "numeric",
      precision: 12,
      scale: 2,
      default: 0,
    },
    deliveryFee: {
      type: "numeric",
      precision: 10,
      scale: 2,
      default: 2.99,
    },
    finalAmount: {
      type: "numeric",
      precision: 12,
      scale: 2,
      default: 0,
    },
    updatedAt: {
      type: "timestamptz",
      default: () => "CURRENT_TIMESTAMP",
    },
  },
  relations: {
    user: {
      target: "User",
      type: "one-to-one",
      joinColumn: { name: "userId" },
    },
  },
  indices: [
    {
      name: "IDX_CART_USER",
      columns: ["userId"],
      unique: true,
    },
  ],
});

module.exports = { Cart };
