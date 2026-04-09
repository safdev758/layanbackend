const express = require('express');
const { 
  getDirections,
  getDistanceMatrix,
  geocodeAddress
} = require('../controllers/routingController');
const { verifyToken } = require('../middleware/authenticattion');

const router = express.Router();

// All routing endpoints require authentication
router.use(verifyToken);

// Get driving directions between two points
// POST /api/routing/directions
router.post('/directions', getDirections);

// Get distance matrix for multiple points
// POST /api/routing/distance-matrix
router.post('/distance-matrix', getDistanceMatrix);

// Geocode an address to coordinates
// POST /api/routing/geocode
router.post('/geocode', geocodeAddress);

module.exports = router;
