const { EntitySchema } = require("typeorm");

const Advertisement = new EntitySchema({
    name: "Advertisement",
    tableName: "advertisements",
    columns: {
        id: {
            type: "uuid",
            primary: true,
            generated: "uuid",
        },
        imageBase64: {
            type: "text",
            nullable: false,
        },
        description: {
            type: "varchar",
            length: 500,
            nullable: false,
        },
        isActive: {
            type: "boolean",
            default: true,
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

module.exports = { Advertisement };
