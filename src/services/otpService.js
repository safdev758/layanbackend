const crypto = require('crypto');
const { sendOtp, verifyOtp } = require('smssak');

function isSmsConfigured() {
  return Boolean(process.env.SMS_PROJECT_ID && process.env.OTP_KEY);
}

/**
 * Send OTP via SMS using smssak service
 */
async function sendOTPViaSMS(phone, otp) {
  const country = process.env.SMS_COUNTRY || 'dz';
  const projectId = process.env.SMS_PROJECT_ID;
  const apiKey = process.env.OTP_KEY;

  if (!projectId || !apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMS is not configured. Cannot send verification code.');
    }
    console.warn('SMS configuration missing. OTP not sent via SMS (development only).');
    return;
  }

  try {
    await sendOtp(country, projectId, phone, apiKey, 'sms');
    console.log(`OTP sent successfully to ${phone} via smssak`);
  } catch (error) {
    console.error('Failed to send OTP via SMS:', error.message);
    throw new Error('Failed to send OTP. Please try again.');
  }
}

/**
 * Verify OTP via smssak service (only when configured).
 */
async function verifyOTPViaSMS(phone, otp) {
  if (!isSmsConfigured()) {
    return false;
  }

  const country = process.env.SMS_COUNTRY || 'dz';
  const projectId = process.env.SMS_PROJECT_ID;
  const apiKey = process.env.OTP_KEY;

  try {
    await verifyOtp(country, projectId, phone, otp, apiKey);
    return true;
  } catch (error) {
    console.error('Failed to verify OTP via SMS:', error.message);
    return false;
  }
}

function generateOTP() {
  return crypto.randomInt(1000, 9999).toString();
}

function generateOTPExpiry() {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 15);
  return expiry;
}

function isOTPExpired(expiryDate) {
  return new Date() > new Date(expiryDate);
}

function validateOTP(inputOTP, storedOTP, expiryDate) {
  if (!storedOTP || !expiryDate) {
    return { valid: false, message: 'No OTP found for this user' };
  }

  if (isOTPExpired(expiryDate)) {
    return { valid: false, message: 'OTP has expired' };
  }

  if (String(inputOTP).trim() !== String(storedOTP).trim()) {
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
  verifyOTPViaSMS,
  isSmsConfigured,
};
