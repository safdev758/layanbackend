const { EntitySchema } = require("typeorm");

const Review = new EntitySchema({
  name: "Review",
  tableName: "reviews",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    productId: {
      type: "uuid",
    },
    userId: {
      type: "uuid",
    },
    userName: {
      type: "varchar",
      length: 255,
    },
    rating: {
      type: "int",
      enum: [1, 2, 3, 4, 5],
    },
    comment: {
      type: "text",
      nullable: true,
    },
    helpful: {
      type: "int",
      default: 0,
    },
    createdAt: {
      type: "timestamptz",
      default: () => "CURRENT_TIMESTAMP",
    },
  },
  relations: {
    product: {
      target: "Product",
      type: "many-to-one",
      joinColumn: { name: "productId" },
      onDelete: "CASCADE",
    },
    user: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "userId" },
      onDelete: "SET NULL",
    },
  },
  indices: [
    {
      name: "IDX_REVIEWS_PRODUCT",
      columns: ["productId"],
    },
  ],
});

module.exports = { Review };
