const { EntitySchema } = require("typeorm");

const OrderItem = new EntitySchema({
  name: "OrderItem",
  tableName: "order_items",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    orderId: {
      type: "uuid",
    },
    productId: {
      type: "uuid",
    },
    quantity: {
      type: "int",
    },
    unitPrice: {
      type: "numeric",
      precision: 10,
      scale: 2,
    },
    selectedOptions: {
      type: "jsonb",
      default: {},
    },
  },
  relations: {
    order: {
      target: "Order",
      type: "many-to-one",
      joinColumn: { name: "orderId" },
      onDelete: "CASCADE",
    },
    product: {
      target: "Product",
      type: "many-to-one",
      joinColumn: { name: "productId" },
    },
  },
  indices: [
    {
      name: "IDX_ORDER_ITEMS_ORDER",
      columns: ["orderId"],
    },
  ],
});

module.exports = { OrderItem };
