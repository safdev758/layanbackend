const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppDataSource } = require('../config/data-source');
const { User } = require('../entities/User');
const AppSetting = require('../entities/AppSetting');
const { generateOTP, generateOTPExpiry, validateOTP, sendOTPViaSMS, verifyOTPViaSMS } = require('./otpService');
const { generateLocationToken, generateLocationVerificationExpiry } = require('./locationVerificationService');

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, otpCode, otpExpiry, ...rest } = user;
  return rest;
}

async function signup({ name, email, password, phone, role = 'CUSTOMER', latitude, longitude }) {
  const repo = AppDataSource.getRepository(User);
  const existing = await repo.findOne({ where: { email } });
  if (existing) {
    const err = new Error('Email already in use');
    err.status = 409;
    throw err;
  }

  // For SUPERMARKET role, location is mandatory (same importance as OTP)
  if (role === 'SUPERMARKET') {
    if (!latitude || !longitude) {
      const err = new Error('Location is required for supermarket registration. Please enable location services.');
      err.status = 400;
      throw err;
    }

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      const err = new Error('Invalid location coordinates');
      err.status = 400;
      throw err;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Generate OTP for phone verification (if phone is provided)
  let otpCode = null;
  let otpExpiry = null;
  let initialStatus = 'ACTIVE'; // Default for users without phone

  if (phone) {
    otpCode = generateOTP();
    otpExpiry = generateOTPExpiry();
    initialStatus = 'PENDING'; // Require OTP verification for phone users
  }

  // Create user with location verification requirements
  const userData = {
    name,
    email,
    passwordHash,
    phone,
    role,
    status: initialStatus,
    phoneVerified: !phone, // Auto-verified if no phone provided
    otpCode,
    otpExpiry,
    preferences: {
      notifications: true,
      language: 'en'
    }
  };

  // Add location data for supermarkets
  if (role === 'SUPERMARKET') {
    userData.latitude = latitude;
    userData.longitude = longitude;
    userData.locationVerified = true; // Auto-verified since location is provided during signup
    // No need for verification token since we're auto-verifying
    userData.locationVerificationToken = null;
    userData.locationVerificationExpiry = null;
  }

  const user = repo.create(userData);
  await repo.save(user);

  // Send OTP via SMS if phone is provided
  if (phone && otpCode) {
    try {
      await sendOTPViaSMS(phone, otpCode);
      console.log(`OTP sent via SMS to ${phone} during signup`);
    } catch (error) {
      console.error(`Failed to send signup OTP: ${error.message}`);
      // Continue even if SMS fails - OTP is stored in DB
    }
  }

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    status: user.status,
    locationVerified: user.locationVerified
  };

  // Require SECRET_KEY in production
  const secret = process.env.SECRET_KEY;
  if (!secret) {
    const err = new Error('SECRET_KEY is not configured. Cannot issue tokens.');
    err.status = 500;
    throw err;
  }

  // Issue tokens ONLY if phone verification is NOT required
  let token = null;
  let refreshTokenValue = null;

  if (!phone || user.phoneVerified) {
    // Issue short-lived access token (15 minutes)
    token = jwt.sign(payload, secret, { expiresIn: '15m' });

    // Issue long-lived refresh token (7 days)
    const refreshPayload = { id: user.id, type: 'refresh' };
    refreshTokenValue = jwt.sign(refreshPayload, secret, { expiresIn: '7d' });
  }

  const response = {
    user: sanitizeUser(user),
    token,
    refreshToken: refreshTokenValue,
    requiresPhoneVerification: !!phone && !user.phoneVerified,
    message: phone ? 'Account created. Please verify your phone number with the OTP sent.' : 'Account created successfully.'
  };

  // Supermarkets are auto-verified if location provided during signup
  if (role === 'SUPERMARKET') {
    if (phone) {
      response.message = 'Account created. Please verify your phone number and location to complete registration.';
    } else {
      response.message = 'Account created and location verified successfully.';
    }
  }

  return response;
}

async function login({ email, password }) {
  console.log(`📡 Login attempt for: ${email}`);
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { email } });

  if (!user) {
    console.log(`❌ User not found for email: ${email}`);
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }
  console.log(`✅ User found: ${user.email} (Role: ${user.role})`);

  // Enforce time-limited access for SUPERMARKET and DRIVER
  if (user.role === 'SUPERMARKET' || user.role === 'DRIVER') {
    try {
      const settingRepo = AppDataSource.getRepository(AppSetting);
      const setting = await settingRepo.findOne({ where: { key: 'deactivationPeriodDays' } });
      const days = parseInt(setting?.value || '60');
      const createdAt = new Date(user.createdAt);
      const expiry = new Date(createdAt);
      expiry.setDate(createdAt.getDate() + days);
      const now = new Date();
      if (now > expiry) {
        if (user.status !== 'SUSPENDED') {
          await repo.update(user.id, { status: 'SUSPENDED', suspendedUntil: null });
          user.status = 'SUSPENDED';
          user.suspendedUntil = null;
        }
      }
    } catch (_) {
      // If settings lookup fails, default behavior continues
    }
  }

  // Handle legacy users without passwordHash
  if (!user.passwordHash) {
    const err = new Error('Account needs to be reset. Please use forgot password.');
    err.status = 401;
    throw err;
  }

  // Handle suspended accounts (time-bound)
  if (user.status === 'SUSPENDED') {
    const now = new Date();
    const until = user.suspendedUntil ? new Date(user.suspendedUntil) : null;
    if (until && until > now) {
      const err = new Error('Account disabled');
      err.status = 403;
      throw err;
    } else {
      // Auto-reactivate if suspension expired or no until set
      await repo.update(user.id, { status: 'ACTIVE', suspendedUntil: null });
      user.status = 'ACTIVE';
      user.suspendedUntil = null;
    }
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  // Block login if phone verification is pending (except for ADMIN users)
  if (user.phone && !user.phoneVerified && user.role !== 'ADMIN') {
    // Generate and send new OTP
    const otpCode = generateOTP();
    const otpExpiry = generateOTPExpiry();

    await repo.update(user.id, {
      otpCode,
      otpExpiry
    });

    try {
      await sendOTPViaSMS(user.phone, otpCode);
      console.log(`Login OTP sent via SMS to ${user.phone}`);
    } catch (error) {
      console.error(`Failed to send login OTP: ${error.message}`);
    }

    const err = new Error('Phone verification required. A new OTP has been sent to your phone.');
    err.status = 403;
    err.requiresPhoneVerification = true;
    err.userId = user.id;
    err.phone = user.phone;
    throw err;
  }

  // Check if store needs location
  if (user.role === 'SUPERMARKET' && (!user.latitude || !user.longitude)) {
    if (user.status !== 'PENDING') {
      await repo.update(user.id, { status: 'PENDING' });
      user.status = 'PENDING';
    }
  }

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    status: user.status
  };

  // Require SECRET_KEY in production
  const secret = process.env.SECRET_KEY;
  if (!secret) {
    const err = new Error('SECRET_KEY is not configured. Cannot issue tokens.');
    err.status = 500;
    throw err;
  }

  // Issue short-lived access token (15 minutes)
  const token = jwt.sign(payload, secret, { expiresIn: '15m' });

  // Issue long-lived refresh token (7 days)
  const refreshPayload = { id: user.id, type: 'refresh' };
  const refreshTokenValue = jwt.sign(refreshPayload, secret, { expiresIn: '7d' });

  return {
    user: sanitizeUser(user),
    token,
    refreshToken: refreshTokenValue
  };
}

async function forgotPassword({ email }) {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { email } });

  if (!user) {
    // Don't reveal if email exists or not for security
    return { message: 'If the email exists, an OTP has been sent' };
  }

  const otpCode = generateOTP();
  const otpExpiry = generateOTPExpiry();

  // Update user with OTP
  await repo.update(user.id, {
    otpCode,
    otpExpiry
  });

  // Send OTP via SMS if phone number exists
  if (user.phone) {
    try {
      await sendOTPViaSMS(user.phone, otpCode);
      console.log(`OTP sent via SMS to ${user.phone}`);
    } catch (error) {
      console.error(`Failed to send SMS OTP: ${error.message}`);
      // Continue even if SMS fails - OTP is still stored in DB
    }
  } else {
    // Fallback: Log OTP for development/email-only users
    console.log(`OTP for ${email}: ${otpCode}`);
  }

  return { message: 'If the email exists, an OTP has been sent' };
}

async function verifyOTP({ email, otpCode }) {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { email } });

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  // First validate OTP from database (Local/Console OTP)
  const localValidation = validateOTP(otpCode, user.otpCode, user.otpExpiry);
  let isValid = localValidation.valid;

  // If local validation failed but user has phone, try verifying via SMS service (smssak OTP)
  if (!isValid && user.phone) {
    try {
      const smsVerified = await verifyOTPViaSMS(user.phone, otpCode);
      if (smsVerified) {
        isValid = true;
      }
    } catch (error) {
      console.error('SMS verification error:', error.message);
    }
  }

  if (!isValid) {
    const err = new Error(localValidation.message || 'Invalid OTP code');
    err.status = 400;
    throw err;
  }

  // Clear OTP after successful verification and activate account
  await repo.update(user.id, {
    otpCode: null,
    otpExpiry: null,
    phoneVerified: true,
    status: 'ACTIVE' // Activate account after phone verification
  });

  // Generate tokens for the verified user
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    status: 'ACTIVE'
  };

  const secret = process.env.SECRET_KEY;
  const token = jwt.sign(payload, secret, { expiresIn: '15m' });

  const refreshPayload = { id: user.id, type: 'refresh' };
  const refreshTokenValue = jwt.sign(refreshPayload, secret, { expiresIn: '7d' });

  return {
    message: 'Phone number verified successfully. Your account is now active.',
    userId: user.id,
    phoneVerified: true,
    token,
    refreshToken: refreshTokenValue,
    user: sanitizeUser(user)
  };
}

async function resetPassword({ email, otpCode, newPassword }) {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { email } });

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const validation = validateOTP(otpCode, user.otpCode, user.otpExpiry);

  if (!validation.valid) {
    const err = new Error(validation.message);
    err.status = 400;
    throw err;
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password and clear OTP
  await repo.update(user.id, {
    passwordHash: hashedPassword,
    otpCode: null,
    otpExpiry: null
  });

  return { message: 'Password reset successfully' };
}

// Logout function (for token blacklisting in production)
async function logout(token) {
  // In production, you would blacklist the token
  // For now, we'll just return success
  return { message: 'Logged out successfully' };
}

// Location verification function (similar to OTP verification)
async function verifyLocation({ userId, verificationToken, latitude, longitude }) {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { id: userId } });

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (user.role !== 'SUPERMARKET') {
    const err = new Error('Location verification is only required for supermarkets');
    err.status = 400;
    throw err;
  }

  if (user.locationVerified) {
    return { message: 'Location already verified', user: sanitizeUser(user) };
  }

  // Check verification token
  if (user.locationVerificationToken !== verificationToken) {
    const err = new Error('Invalid verification token');
    err.status = 401;
    throw err;
  }

  // Check token expiry
  if (!user.locationVerificationExpiry || new Date() > new Date(user.locationVerificationExpiry)) {
    const err = new Error('Verification token expired. Please request a new one.');
    err.status = 401;
    throw err;
  }

  // Verify location accuracy (within 1km of original location)
  const { verifyLocationAccuracy } = require('./locationVerificationService');
  const isLocationAccurate = verifyLocationAccuracy(
    user.latitude, user.longitude,
    latitude, longitude,
    1 // 1km radius
  );

  if (!isLocationAccurate) {
    const err = new Error('Location verification failed. You are too far from the registered location.');
    err.status = 401;
    throw err;
  }

  // Mark location as verified and update user status
  await repo.update(user.id, {
    locationVerified: true,
    locationVerificationToken: null,
    locationVerificationExpiry: null,
    status: 'ACTIVE' // Activate the account after location verification
  });

  // Get updated user
  const updatedUser = await repo.findOne({ where: { id: userId } });

  return {
    message: 'Location verified successfully. Your account is now active.',
    user: sanitizeUser(updatedUser)
  };
}

// Resend location verification token
async function resendLocationVerification({ userId }) {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { id: userId } });

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (user.role !== 'SUPERMARKET') {
    const err = new Error('Location verification is only required for supermarkets');
    err.status = 400;
    throw err;
  }

  if (user.locationVerified) {
    const err = new Error('Location already verified');
    err.status = 400;
    throw err;
  }

  // Generate new verification token
  const newToken = generateLocationToken();
  const newExpiry = generateLocationVerificationExpiry();

  await repo.update(user.id, {
    locationVerificationToken: newToken,
    locationVerificationExpiry: newExpiry
  });

  return {
    message: 'Location verification token sent successfully',
    locationVerificationToken: newToken,
    expiry: newExpiry
  };
}

// Resend signup OTP for phone verification
async function resendSignupOTP({ email }) {
  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { email } });

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (!user.phone) {
    const err = new Error('No phone number associated with this account');
    err.status = 400;
    throw err;
  }

  if (user.phoneVerified) {
    const err = new Error('Phone number already verified');
    err.status = 400;
    throw err;
  }

  // Generate new OTP
  const otpCode = generateOTP();
  const otpExpiry = generateOTPExpiry();

  await repo.update(user.id, {
    otpCode,
    otpExpiry
  });

  // Send OTP via SMS
  try {
    await sendOTPViaSMS(user.phone, otpCode);
    console.log(`Signup OTP resent to ${user.phone}`);
  } catch (error) {
    console.error(`Failed to resend signup OTP: ${error.message}`);
    throw new Error('Failed to send OTP. Please try again.');
  }

  return {
    message: 'OTP sent successfully to your phone number',
    phone: user.phone
  };
}

// Refresh token function - requires valid refresh token
async function refreshToken(refreshToken) {
  const secret = process.env.SECRET_KEY;
  if (!secret) {
    const err = new Error('SECRET_KEY is not configured');
    err.status = 500;
    throw err;
  }

  // Verify refresh token
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, secret);
  } catch (err) {
    const error = new Error('Invalid or expired refresh token');
    error.status = 401;
    throw error;
  }

  // Ensure it's a refresh token
  if (decoded.type !== 'refresh') {
    const err = new Error('Invalid token type');
    err.status = 401;
    throw err;
  }

  const repo = AppDataSource.getRepository(User);
  const user = await repo.findOne({ where: { id: decoded.id } });

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  // Check if user is still active
  if (user.status !== 'ACTIVE') {
    const err = new Error('Account is not active');
    err.status = 403;
    throw err;
  }

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    status: user.status
  };

  // Issue new short-lived access token
  const newToken = jwt.sign(payload, secret, { expiresIn: '15m' });

  // Issue new refresh token (rotation)
  const newRefreshPayload = { id: user.id, type: 'refresh' };
  const newRefreshToken = jwt.sign(newRefreshPayload, secret, { expiresIn: '7d' });

  return {
    token: newToken,
    refreshToken: newRefreshToken
  };
}

module.exports = {
  signup,
  login,
  logout,
  refreshToken,
  forgotPassword,
  verifyOTP,
  resetPassword,
  verifyLocation,
  resendLocationVerification,
  resendSignupOTP
};
