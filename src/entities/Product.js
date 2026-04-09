const { EntitySchema } = require("typeorm");

const Product = new EntitySchema({
  name: "Product",
  tableName: "products",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    ownerId: {
      type: "uuid",
      nullable: false,
    },
    isGlobal: {
      name: "is_global",
      type: "boolean",
      default: false,
    },
    globalProductId: {
      name: "global_product_id",
      type: "uuid",
      nullable: true,
    },
    name: {
      type: "varchar",
      length: 255,
    },
    price: {
      type: "numeric",
      precision: 10,
      scale: 2,
    },
    originalPrice: {
      type: "numeric",
      precision: 10,
      scale: 2,
      nullable: true,
    },
    imageUrl: {
      name: "image",
      type: "text",
      nullable: true,
    },
    categoryId: {
      type: "uuid",
    },
    description: {
      type: "text",
      nullable: true,
    },
    isOnSale: {
      type: "boolean",
      default: false,
    },
    rating: {
      type: "numeric",
      precision: 3,
      scale: 2,
      default: 0,
    },
    reviewCount: {
      type: "int",
      default: 0,
    },
    images: {
      type: "text",
      array: true,
      default: [],
    },
    nutritionalInfo: {
      type: "jsonb",
      nullable: true,
    },
    brand: {
      type: "varchar",
      length: 100,
      nullable: true,
    },
    weight: {
      type: "varchar",
      length: 50,
      nullable: true,
    },
    expiryDate: {
      type: "date",
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
    category: {
      target: "Category",
      type: "many-to-one",
      joinColumn: { name: "categoryId" },
    },
    owner: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "ownerId" },
    },
    reviews: {
      target: "Review",
      type: "one-to-many",
      inverseSide: "product",
    },
    orderItems: {
      target: "OrderItem",
      type: "one-to-many",
      inverseSide: "product",
    },
  },
  indices: [
    {
      name: "IDX_PRODUCT_CATEGORY",
      columns: ["categoryId"],
    },
    {
      name: "IDX_PRODUCT_OWNER",
      columns: ["ownerId"],
    },
    {
      name: "IDX_PRODUCT_OWNER_CREATED",
      columns: ["ownerId", "createdAt"],
    },
  ],
});

module.exports = { Product };

