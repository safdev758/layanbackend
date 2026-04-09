const crypto = require('crypto');

/**
 * Generate location verification token
 * Similar to OTP but for location verification
 */
function generateLocationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate location verification expiry (15 minutes)
 */
function generateLocationVerificationExpiry() {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 15);
  return expiry;
}

/**
 * Validate location verification token
 */
function validateLocationVerificationToken(token, expiry) {
  if (!token || !expiry) return false;
  
  const now = new Date();
  const expiryDate = new Date(expiry);
  
  return token && expiryDate > now;
}

/**
 * Calculate distance between two coordinates in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

/**
 * Verify if provided location is within acceptable range
 * Allow 1km radius for location verification
 */
function verifyLocationAccuracy(storedLat, storedLon, providedLat, providedLon, maxDistanceKm = 1) {
  const distance = calculateDistance(storedLat, storedLon, providedLat, providedLon);
  return distance <= maxDistanceKm;
}

module.exports = {
  generateLocationToken,
  generateLocationVerificationExpiry,
  validateLocationVerificationToken,
  calculateDistance,
  verifyLocationAccuracy
};
