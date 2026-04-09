const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { WebSocketServer } = require('ws');
const { AppDataSource } = require('./src/config/data-source');
const WebSocketService = require('./src/services/websocketService');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const categoryRoutes = require('./src/routes/categories');
const productRoutes = require('./src/routes/products');
const cartRoutes = require('./src/routes/cart');
const orderRoutes = require('./src/routes/orders');
const driverRoutes = require('./src/routes/drivers');
const reviewRoutes = require('./src/routes/reviews');
const searchRoutes = require('./src/routes/search');
const marketplaceRoutes = require('./src/routes');
const adminRoutes = require('./src/routes/admin');
const routingRoutes = require('./src/routes/routing');
const {
  startDriverOrderCleanupService,
  stopDriverOrderCleanupService
} = require('./src/services/driverOrderCleanupService');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize WebSocket Server
const wss = new WebSocketServer({ server });
const port = process.env.PORT || 3000;

// Initialize WebSocket service
const wsService = new WebSocketService(wss);

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Increased payload limit to 10MB
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploads
app.use('/uploads', express.static('uploads'));

// Make WebSocket service available to routes
app.use((req, res, next) => {
  req.wsService = wsService;
  next();
});

// Routes
app.use('/api/v1', marketplaceRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/routing', routingRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Ensure we always send a response
  if (!res.headersSent) {
    res.status(status).json({
      message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Initialize DB and start server
async function initializeDataSourceWithRetry(maxAttempts = 8, delayMs = 3000) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await AppDataSource.initialize();
      console.log('Data Source has been initialized.');
      return;
    } catch (error) {
      lastError = error;
      console.error(`Database init attempt ${attempt}/${maxAttempts} failed:`, error.message || error);

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

async function ensureRequiredTables() {
  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS advertisements (
      id UUID PRIMARY KEY,
      "imageBase64" TEXT NOT NULL,
      description VARCHAR(500) NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS marketplace_items (
      id UUID PRIMARY KEY,
      "ownerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      price NUMERIC(10, 2) NOT NULL,
      images TEXT[] DEFAULT '{}',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS threads (
      id UUID PRIMARY KEY,
      "itemId" UUID NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
      "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "sellerId" UUID,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await AppDataSource.query(`
    ALTER TABLE threads
    ADD COLUMN IF NOT EXISTS "sellerId" UUID;
  `);

  await AppDataSource.query(`
    UPDATE threads t
    SET "sellerId" = mi."ownerId"
    FROM marketplace_items mi
    WHERE t."itemId" = mi.id
      AND t."sellerId" IS NULL;
  `);

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY,
      "threadId" UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      "senderId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_marketplace_owner ON marketplace_items("ownerId");
  `);
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_marketplace_created ON marketplace_items("createdAt");
  `);
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_thread_item ON threads("itemId");
  `);
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_thread_user ON threads("userId");
  `);
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_thread_seller ON threads("sellerId");
  `);
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_thread_item_user ON threads("itemId", "userId");
  `);
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_message_thread ON messages("threadId");
  `);
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_message_created ON messages("createdAt");
  `);

  console.log('Ensured required tables: advertisements, marketplace_items, threads, messages');
}

initializeDataSourceWithRetry()
  .then(async () => {
    await ensureRequiredTables();
    startDriverOrderCleanupService();
    server.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Error during Data Source initialization:', error);
    process.exit(1);
  });

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit immediately to allow in-flight requests to complete
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGINT', () => {
  stopDriverOrderCleanupService();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopDriverOrderCleanupService();
  process.exit(0);
});
