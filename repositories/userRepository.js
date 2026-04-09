const { AppDataSource } = require("../src/config/data-source");
const { User } = require("../src/entities/User");

// Return the repository at call time to ensure the DataSource is initialized
function getUserRepository() {
  return AppDataSource.getRepository(User);
}

module.exports = { getUserRepository };
