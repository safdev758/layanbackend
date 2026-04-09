const crypto = require('crypto');
const { sendOtp, verifyOtp } = require('smssak');

/**
 * Send OTP via SMS using smssak service
 * @param {string} phone - Phone number (without country code)
 * @param {string} otp - OTP code
 * @returns {Promise<void>}
 */
async function sendOTPViaSMS(phone, otp) {
  const country = process.env.SMS_COUNTRY || 'dz'; // Default to Algeria
  const projectId = process.env.SMS_PROJECT_ID;
  const apiKey = process.env.OTP_KEY;

  if (!projectId || !apiKey) {
    console.warn('SMS configuration missing (SMS_PROJECT_ID or OTP_KEY). Skipping SMS send.');
    console.log(`OTP for ${phone}: ${otp}`);
    return;
  }

  try {
    // smssak.sendOtp(country, projectId, phone, key, type)
    await sendOtp(country, projectId, phone, apiKey, 'sms');
    console.log(`OTP sent successfully to ${phone} via smssak`);
    console.log(`OTP for ${phone}: ${otp}`); // Always log OTP for debugging/fallback
  } catch (error) {
    console.error('Failed to send OTP via SMS:', error.message);
    // Fallback: Log OTP for development
    console.log(`OTP for ${phone}: ${otp}`);
    throw new Error('Failed to send OTP. Please try again.');
  }
}

/**
 * Verify OTP via smssak service
 * @param {string} phone - Phone number (without country code)
 * @param {string} otp - OTP code to verify
 * @returns {Promise<boolean>}
 */
async function verifyOTPViaSMS(phone, otp) {
  const country = process.env.SMS_COUNTRY || 'dz';
  const projectId = process.env.SMS_PROJECT_ID;
  const apiKey = process.env.OTP_KEY;

  if (!projectId || !apiKey) {
    console.warn('SMS configuration missing. Skipping SMS verification.');
    return true; // Skip SMS verification in development
  }

  try {
    // smssak.verifyOtp(country, projectId, phone, otp, key)
    await verifyOtp(country, projectId, phone, otp, apiKey);
    console.log(`OTP verified successfully via smssak for ${phone}`);
    return true;
  } catch (error) {
    console.error('Failed to verify OTP via SMS:', error.message);
    return false;
  }
}

/**
 * Generate a 6-digit OTP code
 * @returns {string} 6-digit OTP code
 */
function generateOTP() {
  return crypto.randomInt(1000, 9999).toString();
}

/**
 * Generate OTP expiry time (15 minutes from now)
 * @returns {Date} Expiry date
 */
function generateOTPExpiry() {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 15); // 15 minutes from now
  return expiry;
}

/**
 * Check if OTP is expired
 * @param {Date} expiryDate - OTP expiry date
 * @returns {boolean} True if expired
 */
function isOTPExpired(expiryDate) {
  return new Date() > new Date(expiryDate);
}

/**
 * Validate OTP code
 * @param {string} inputOTP - User input OTP
 * @param {string} storedOTP - Stored OTP in database
 * @param {Date} expiryDate - OTP expiry date
 * @returns {object} Validation result
 */
function validateOTP(inputOTP, storedOTP, expiryDate) {
  if (!storedOTP || !expiryDate) {
    return { valid: false, message: 'No OTP found for this user' };
  }

  if (isOTPExpired(expiryDate)) {
    return { valid: false, message: 'OTP has expired' };
  }

  if (inputOTP !== storedOTP) {
    return { valid: false, message: 'Invalid OTP code' };
  }

  return { valid: true, message: 'OTP is valid' };
}

module.exports = {
  generateOTP,
  generateOTPExpiry,
  isOTPExpired,
  validateOTP,
  sendOTPViaSMS,
  verifyOTPViaSMS
};
