const { AppDataSource } = require('../config/data-source');

const migrationQueries = [
  `
  CREATE TABLE IF NOT EXISTS store_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "displayName" VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    "profileImage" VARCHAR(500),
    images TEXT[] DEFAULT '{}',
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
  );
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_store_profiles_name ON store_profiles("displayName");
  `,
  `
  INSERT INTO store_profiles ("userId", "displayName", phone, "profileImage", latitude, longitude, images)
  SELECT
    id,
    name,
    phone,
    "profileImage",
    latitude,
    longitude,
    CASE
      WHEN "profileImage" IS NOT NULL AND "profileImage" <> '' THEN ARRAY["profileImage"]
      ELSE '{}'::TEXT[]
    END
  FROM users
  WHERE role = 'SUPERMARKET'
  ON CONFLICT ("userId") DO NOTHING;
  `,
];

async function run() {
  try {
    await AppDataSource.initialize();
    console.log('[Migration] Connected');

    for (const query of migrationQueries) {
      await AppDataSource.query(query);
    }

    console.log('[Migration] store_profiles table ready and SUPERMARKET users backfilled');
  } catch (error) {
    console.error('[Migration] Failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

run();
