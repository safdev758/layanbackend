const { AppDataSource } = require('./src/config/data-source');

async function migrateEmojiToImage({ drop = false } = {}) {
  try {
    console.log('Starting emoji -> image migration...');
    await AppDataSource.initialize();
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if products table has emoji column
      const hasEmoji = await queryRunner.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'emoji'`
      );

      if (!hasEmoji || hasEmoji.length === 0) {
        console.log('No emoji column found on products table — nothing to migrate');
        await queryRunner.commitTransaction();
        return;
      }

      // Add image column if missing
      const hasImage = await queryRunner.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'image'`
      );

      if (!hasImage || hasImage.length === 0) {
        console.log('Adding image column to products table...');
        await queryRunner.query(`ALTER TABLE products ADD COLUMN image VARCHAR(500)`);
      } else {
        console.log('image column already exists');
      }

      // Copy emoji values into image as base64
      console.log('Copying emoji values into image column (base64)...');
      const emojiRows = await queryRunner.query(`SELECT id, emoji FROM products WHERE emoji IS NOT NULL`);
      for (const row of emojiRows) {
        const id = row.id;
        const emoji = row.emoji;
        if (!emoji) continue;
        const b64 = Buffer.from(String(emoji)).toString('base64');
        await queryRunner.query(`UPDATE products SET image = $1 WHERE id = $2`, [b64, id]);
      }

      // Convert any existing image values that look like URLs into base64 by fetching the remote image
      console.log('Converting image URLs to base64 where applicable...');
      const imageRows = await queryRunner.query(`SELECT id, image FROM products WHERE image IS NOT NULL`);
      const isUrl = (s) => typeof s === 'string' && /^https?:\/\//i.test(s);
      const http = require('http');
      const https = require('https');

      for (const row of imageRows) {
        const id = row.id;
        const imageVal = row.image;
        if (!imageVal) continue;
        // If already looks like base64 (simple heuristic), skip
        if (/^[A-Za-z0-9+/]+={0,2}$/.test(imageVal) && imageVal.length > 8) continue;

        if (isUrl(imageVal)) {
          try {
            const client = imageVal.startsWith('https') ? https : http;
            const b64 = await new Promise((resolve, reject) => {
              const req = client.get(imageVal, { timeout: 10000 }, (res) => {
                if (res.statusCode !== 200) {
                  res.resume();
                  return reject(new Error('Failed to fetch image: ' + res.statusCode));
                }
                const chunks = [];
                let total = 0;
                res.on('data', (chunk) => {
                  total += chunk.length;
                  // limit to 1MB to avoid huge blobs
                  if (total > 1024 * 1024) {
                    req.abort();
                    return reject(new Error('Image too large'));
                  }
                  chunks.push(chunk);
                });
                res.on('end', () => {
                  const buffer = Buffer.concat(chunks);
                  resolve(buffer.toString('base64'));
                });
              });
              req.on('error', reject);
              req.on('timeout', () => {
                req.abort();
                reject(new Error('Request timed out'));
              });
            });

            if (b64) {
              await queryRunner.query(`UPDATE products SET image = $1 WHERE id = $2`, [b64, id]);
            }
          } catch (err) {
            console.warn(`Could not fetch/convert image for product ${id}: ${err.message}`);
          }
        }
      }

      if (drop) {
        console.log('Dropping emoji column...');
        await queryRunner.query(`ALTER TABLE products DROP COLUMN IF EXISTS emoji`);
      } else {
        console.log('Leaving emoji column intact (use --drop to remove it)');
      }

      await queryRunner.commitTransaction();
      console.log('✅ emoji -> image migration completed successfully');
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const drop = args.includes('--drop');
  migrateEmojiToImage({ drop });
}

module.exports = { migrateEmojiToImage };
