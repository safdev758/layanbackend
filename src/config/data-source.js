require('reflect-metadata');
const { DataSource } = require('typeorm');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');
const net = require('net');
const { User } = require('../entities/User');
const { Product } = require('../entities/Product');
const { Address } = require('../entities/Address');
const { Category } = require('../entities/Category');
const { Cart } = require('../entities/Cart');
const { Order } = require('../entities/Order');
const { OrderItem } = require('../entities/OrderItem');
const { Review } = require('../entities/Review');
const { DriverTrip } = require('../entities/DriverTrip');
const { MarketplaceItem } = require('../entities/MarketplaceItem');
const { Thread } = require('../entities/Thread');
const { Message } = require('../entities/Message');
const { GlobalProduct } = require('../entities/GlobalProduct');
const { AppSetting } = require('../entities/AppSetting');
const { Advertisement } = require('../entities/Advertisement');

// Avoid intermittent ETIMEDOUT issues on Node 22 dual-stack auto-selection.
dns.setDefaultResultOrder('ipv4first');
if (typeof net.setDefaultAutoSelectFamily === 'function') {
  net.setDefaultAutoSelectFamily(false);
}

// Load .env from the root directory
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Parse the Neon connection string manually
const connectionString = process.env.DATABASE_URL;
// SECURITY: Do not log connection strings containing credentials
if (!connectionString) {
  console.error('DATABASE_URL environment variable is not set');
  throw new Error('DATABASE_URL environment variable is not set');
}
console.log('Database connection configured');

const url = new URL(connectionString);

const AppDataSource = new DataSource({
  type: 'postgres',
  host: url.hostname,
  port: parseInt(url.port) || 5432,
  username: url.username,
  password: url.password,
  database: url.pathname.slice(1), // Remove leading slash
  synchronize: false, // PRODUCTION SAFE: Disabled to prevent table drops/mutations
  logging: false,
  entities: [User, Product, Address, Category, Cart, Order, OrderItem, Review, DriverTrip, MarketplaceItem, Thread, Message, GlobalProduct, AppSetting, Advertisement],
  ssl: true, // Enable SSL
  extra: {
    ssl: {
      rejectUnauthorized: false
    },
    // Connection pool settings
    max: 20, // Maximum number of connections in pool
    min: 2, // Minimum number of connections in pool
    idleTimeoutMillis: 30000, // How long a connection can be idle before being released
    connectionTimeoutMillis: 10000, // How long to wait when connecting
    acquireTimeoutMillis: 30000 // How long to wait for a connection from the pool
  }
});

module.exports = { AppDataSource };
