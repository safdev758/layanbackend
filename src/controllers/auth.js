const asyncHandler = require('../middleware/asyncHandler');
const { signup, login, logout, refreshToken, forgotPassword, verifyOTP, resetPassword, verifyLocation, resendLocationVerification, resendSignupOTP } = require('../services/authService');

const signupController = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role = 'CUSTOMER', latitude, longitude } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email and password are required' });
  }
  const result = await signup({ name, email, password, phone, role, latitude, longitude });
  res.status(201).json(result);
});

const loginController = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }
  const result = await login({ email, password });
  res.status(200).json(result);
});

const forgotPasswordController = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  const result = await forgotPassword({ email });
  res.status(200).json(result);
});

const verifyOTPController = asyncHandler(async (req, res) => {
  const { email, otpCode } = req.body;
  if (!email || !otpCode) {
    return res.status(400).json({ message: 'Email and OTP code are required' });
  }
  const result = await verifyOTP({ email, otpCode });
  res.status(200).json(result);
});

const resetPasswordController = asyncHandler(async (req, res) => {
  const { email, otpCode, newPassword } = req.body;
  if (!email || !otpCode || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP code, and new password are required' });
  }
  const result = await resetPassword({ email, otpCode, newPassword });
  res.status(200).json(result);
});

const verifyLocationController = asyncHandler(async (req, res) => {
  const { userId, verificationToken, latitude, longitude } = req.body;
  if (!userId || !verificationToken || !latitude || !longitude) {
    return res.status(400).json({ message: 'User ID, verification token, and location are required' });
  }
  const result = await verifyLocation({ userId, verificationToken, latitude, longitude });
  res.status(200).json(result);
});

const resendLocationVerificationController = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }
  const result = await resendLocationVerification({ userId });
  res.status(200).json(result);
});

const resendSignupOTPController = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  const result = await resendSignupOTP({ email });
  res.status(200).json(result);
});

const logoutController = asyncHandler(async (req, res) => {
  // Token is now available via req.token (set by verifyToken middleware)
  const result = await logout(req.token);
  res.status(200).json(result);
});

const refreshTokenController = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }
  const result = await refreshToken(token);
  res.status(200).json(result);
});

module.exports = {
  signupController,
  loginController,
  logoutController,
  refreshTokenController,
  forgotPasswordController,
  verifyOTPController,
  resetPasswordController,
  verifyLocationController,
  resendLocationVerificationController,
  resendSignupOTPController
};
