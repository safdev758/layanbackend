const { EntitySchema } = require("typeorm");

const Message = new EntitySchema({
  name: "Message",
  tableName: "messages",
  columns: {
    id: {
      type: "uuid",
      primary: true,
      generated: "uuid",
    },
    threadId: {
      type: "uuid",
      nullable: false,
    },
    senderId: {
      type: "uuid",
      nullable: false,
    },
    content: {
      type: "text",
      nullable: false,
    },
    createdAt: {
      type: "timestamptz",
      default: () => "CURRENT_TIMESTAMP",
    },
  },
  relations: {
    thread: {
      target: "Thread",
      type: "many-to-one",
      joinColumn: { name: "threadId" },
      onDelete: "CASCADE",
    },
    sender: {
      target: "User",
      type: "many-to-one",
      joinColumn: { name: "senderId" },
    },
  },
  indices: [
    {
      name: "IDX_MESSAGE_THREAD",
      columns: ["threadId"],
    },
    {
      name: "IDX_MESSAGE_SENDER",
      columns: ["senderId"],
    },
    {
      name: "IDX_MESSAGE_CREATED",
      columns: ["createdAt"],
    },
  ],
});

module.exports = { Message };

