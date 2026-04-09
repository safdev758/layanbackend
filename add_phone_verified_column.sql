-- Migration: Add phone_verified column to users table
-- Run this SQL script in your Neon database console

-- Add the phone_verified column if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Update existing users:
-- Users without phone numbers are considered verified
UPDATE users 
SET phone_verified = true 
WHERE phone IS NULL OR phone = '';

-- ADMIN users are always considered verified (exempt from phone verification)
UPDATE users 
SET phone_verified = true 
WHERE role = 'ADMIN';

-- Verify the changes
SELECT id, name, email, phone, role, phone_verified, status 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;
