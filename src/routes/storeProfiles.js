const express = require('express');
const {
  getStoreProfileById,
  getMyStoreProfile,
  updateMyStoreProfile,
} = require('../controllers/storeProfileController');
const { verifyToken, requireRole } = require('../middleware/authenticattion');

const router = express.Router();

router.get('/me', verifyToken, requireRole('SUPERMARKET'), getMyStoreProfile);
router.put('/me', verifyToken, requireRole('SUPERMARKET'), updateMyStoreProfile);
router.get('/:id', getStoreProfileById);

module.exports = router;
