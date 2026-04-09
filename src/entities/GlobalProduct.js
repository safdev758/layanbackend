const { EntitySchema } = require("typeorm");

const GlobalProduct = new EntitySchema({
  name: "GlobalProduct",
  tableName: "global_products",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    name: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    description: {
      type: "text",
      nullable: true,
    },
    image: {
      type: "text",
      nullable: true,
    },
    categoryId: {
      type: "uuid",
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
    nutritionalInfo: {
      type: "jsonb",
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
  },
});

module.exports = { GlobalProduct };
