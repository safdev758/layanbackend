const express = require('express');
const { 
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
} = require('../controllers/auth');
const { verifyToken } = require('../middleware/authenticattion');

const router = express.Router();

// Authentication routes
router.post('/signup', signupController);
router.post('/login', loginController);
router.post('/logout', verifyToken, logoutController);
router.post('/refresh', refreshTokenController);

// Password recovery routes
router.post('/forgot-password', forgotPasswordController);
router.post('/verify-otp', verifyOTPController);
router.post('/reset-password', resetPasswordController);

// Phone verification routes (for signup)
router.post('/resend-signup-otp', resendSignupOTPController);

// Location verification routes (mandatory for supermarkets)
router.post('/verify-location', verifyLocationController);
router.post('/resend-location-verification', resendLocationVerificationController);

module.exports = router;
