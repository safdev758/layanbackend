const { EntitySchema } = require("typeorm");

const AppSetting = new EntitySchema({
  name: "AppSetting",
  tableName: "app_settings",
  columns: {
    key: {
      type: "varchar",
      primary: true,
      length: 100,
    },
    value: {
      type: "varchar",
      length: 255,
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
});

module.exports = AppSetting;
