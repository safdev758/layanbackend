require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Postgres. Starting DB repair (no TypeORM sync)...');

  const queries = [
    // Ensure a stable admin user exists
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@system.local') THEN
         INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
         VALUES ('00000000-0000-0000-0000-000000000001', 'System Admin', 'admin@system.local', 'ADMIN', 'ACTIVE', NOW(), NOW());
       END IF;
     END$$;`,

    // threads.userId
    `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
     SELECT DISTINCT t."userId",
            'Temp User ' || substr(t."userId"::text,1,8),
            t."userId"::text || '@temp.local',
            'CUSTOMER','ACTIVE', NOW(), NOW()
     FROM threads t
     LEFT JOIN users u ON u.id = t."userId"
     WHERE t."userId" IS NOT NULL AND u.id IS NULL;`,

    // threads.sellerId
    `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
     SELECT DISTINCT t."sellerId",
            'Temp Seller ' || substr(t."sellerId"::text,1,8),
            t."sellerId"::text || '@temp.local',
            'SUPERMARKET','ACTIVE', NOW(), NOW()
     FROM threads t
     LEFT JOIN users u ON u.id = t."sellerId"
     WHERE t."sellerId" IS NOT NULL AND u.id IS NULL;`,

    // marketplace_items.ownerId
    `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
     SELECT DISTINCT mi."ownerId",
            'Temp Owner ' || substr(mi."ownerId"::text,1,8),
            mi."ownerId"::text || '@temp.local',
            'SUPERMARKET','ACTIVE', NOW(), NOW()
     FROM marketplace_items mi
     LEFT JOIN users u ON u.id = mi."ownerId"
     WHERE mi."ownerId" IS NOT NULL AND u.id IS NULL;`,

    // messages.senderId
    `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
     SELECT DISTINCT m."senderId",
            'Temp Sender ' || substr(m."senderId"::text,1,8),
            m."senderId"::text || '@temp.local',
            'CUSTOMER','ACTIVE', NOW(), NOW()
     FROM messages m
     LEFT JOIN users u ON u.id = m."senderId"
     WHERE m."senderId" IS NOT NULL AND u.id IS NULL;`,

    // orders.userId
    `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
     SELECT DISTINCT o."userId",
            'Temp User ' || substr(o."userId"::text,1,8),
            o."userId"::text || '@temp.local',
            'CUSTOMER','ACTIVE', NOW(), NOW()
     FROM orders o
     LEFT JOIN users u ON u.id = o."userId"
     WHERE o."userId" IS NOT NULL AND u.id IS NULL;`,

    // orders.driverId
    `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
     SELECT DISTINCT o."driverId",
            'Temp Driver ' || substr(o."driverId"::text,1,8),
            o."driverId"::text || '@temp.local',
            'DRIVER','ACTIVE', NOW(), NOW()
     FROM orders o
     LEFT JOIN users u ON u.id = o."driverId"
     WHERE o."driverId" IS NOT NULL AND u.id IS NULL;`,

    // carts.userId
    `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
     SELECT DISTINCT c."userId",
            'Temp User ' || substr(c."userId"::text,1,8),
            c."userId"::text || '@temp.local',
            'CUSTOMER','ACTIVE', NOW(), NOW()
     FROM carts c
     LEFT JOIN users u ON u.id = c."userId"
     WHERE c."userId" IS NOT NULL AND u.id IS NULL;`,

    // addresses.userId
    `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
     SELECT DISTINCT a."userId",
            'Temp User ' || substr(a."userId"::text,1,8),
            a."userId"::text || '@temp.local',
            'CUSTOMER','ACTIVE', NOW(), NOW()
     FROM addresses a
     LEFT JOIN users u ON u.id = a."userId"
     WHERE a."userId" IS NOT NULL AND u.id IS NULL;`,

    // reviews.userId
    `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
     SELECT DISTINCT r."userId",
            'Temp User ' || substr(r."userId"::text,1,8),
            r."userId"::text || '@temp.local',
            'CUSTOMER','ACTIVE', NOW(), NOW()
     FROM reviews r
     LEFT JOIN users u ON u.id = r."userId"
     WHERE r."userId" IS NOT NULL AND u.id IS NULL;`,

    // products.ownerId
    `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
     SELECT DISTINCT p."ownerId",
            'Temp Owner ' || substr(p."ownerId"::text,1,8),
            p."ownerId"::text || '@temp.local',
            'SUPERMARKET','ACTIVE', NOW(), NOW()
     FROM products p
     LEFT JOIN users u ON u.id = p."ownerId"
     WHERE p."ownerId" IS NOT NULL AND u.id IS NULL;`,

    // driver_trips.driverId
    `INSERT INTO users (id, name, email, role, status, "createdAt", "updatedAt")
     SELECT DISTINCT dt."driverId",
            'Temp Driver ' || substr(dt."driverId"::text,1,8),
            dt."driverId"::text || '@temp.local',
            'DRIVER','ACTIVE', NOW(), NOW()
     FROM driver_trips dt
     LEFT JOIN users u ON u.id = dt."driverId"
     WHERE dt."driverId" IS NOT NULL AND u.id IS NULL;`,

    // Deduplicate threads on (itemId, userId)
    `WITH ranked AS (
       SELECT ctid,
              ROW_NUMBER() OVER (
                PARTITION BY "itemId","userId"
                ORDER BY "createdAt" DESC NULLS LAST, "id"
              ) AS rn
       FROM threads
     ),
     to_delete AS (
       SELECT ctid FROM ranked WHERE rn > 1
     )
     DELETE FROM threads t
     USING to_delete d
     WHERE t.ctid = d.ctid;`
  ];

  try {
    for (const sql of queries) {
      await client.query(sql);
    }
    console.log('DB repair completed successfully.');
  } catch (err) {
    console.error('DB repair failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
