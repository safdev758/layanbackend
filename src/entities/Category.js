const { EntitySchema } = require("typeorm");

const Category = new EntitySchema({
  name: "Category",
  tableName: "categories",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    name: {
      type: "varchar",
      length: 100,
    },
    emoji: {
      type: "varchar",
      length: 10,
      nullable: true,
    },
    color: {
      type: "varchar",
      length: 7,
      nullable: true,
    },
    description: {
      type: "text",
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
    products: {
      target: "Product",
      type: "one-to-many",
      inverseSide: "category",
    },
  },
});

module.exports = { Category };
