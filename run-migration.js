const fs = require('fs');
const path = require('path');
const { AppDataSource } = require('./src/config/data-source');

async function runMigration() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('✓ Database connected');

    const sqlPath = path.join(__dirname, 'database-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running migration...');
    await AppDataSource.query(sql);
    console.log('✓ Migration completed successfully!');

    await AppDataSource.destroy();
    console.log('✓ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
