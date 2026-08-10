const { StoreProfile } = require('../entities/StoreProfile');

/** Keep customer browse radius aligned with driver available-deliveries radius */
const DEFAULT_MARKETPLACE_RADIUS_KM = 25;

function parseCoords(lat, lng) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

/**
 * Resolve customer coords from query params, then authenticated user profile.
 */
function resolveCustomerCoords(req) {
  const fromQuery = parseCoords(
    req.query?.lat ?? req.query?.latitude,
    req.query?.lng ?? req.query?.longitude
  );
  if (fromQuery) return fromQuery;

  const profile = req.userRecord || req.user;
  if (profile) {
    return parseCoords(profile.latitude, profile.longitude);
  }
  return null;
}

function parseRadiusKm(value, fallback = DEFAULT_MARKETPLACE_RADIUS_KM) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 100);
}

/**
 * Restrict a product query to stores within radiusKm of the customer.
 * Expects `product.owner` already joined as alias `owner`.
 */
function applyNearbyOwnerFilter(query, latitude, longitude, radiusKm = DEFAULT_MARKETPLACE_RADIUS_KM) {
  return query
    .leftJoin(StoreProfile, 'storeProfile', 'storeProfile.userId = owner.id')
    .andWhere('owner.role = :supermarketRole', { supermarketRole: 'SUPERMARKET' })
    .andWhere(
      `(
        COALESCE(owner.latitude, storeProfile.latitude) IS NOT NULL
        AND COALESCE(owner.longitude, storeProfile.longitude) IS NOT NULL
        AND (
          6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(:customerLat)) *
              cos(radians(COALESCE(owner.latitude, storeProfile.latitude))) *
              cos(radians(COALESCE(owner.longitude, storeProfile.longitude)) - radians(:customerLng)) +
              sin(radians(:customerLat)) *
              sin(radians(COALESCE(owner.latitude, storeProfile.latitude)))
            ))
          )
        ) <= :radiusKm
      )`,
      { customerLat: latitude, customerLng: longitude, radiusKm }
    );
}

/**
 * Restrict a store_profiles query (alias `profile`) joined to `user`.
 */
function applyNearbyStoreProfileFilter(query, latitude, longitude, radiusKm = DEFAULT_MARKETPLACE_RADIUS_KM) {
  return query.andWhere(
    `(
      COALESCE(user.latitude, profile.latitude) IS NOT NULL
      AND COALESCE(user.longitude, profile.longitude) IS NOT NULL
      AND (
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(:customerLat)) *
            cos(radians(COALESCE(user.latitude, profile.latitude))) *
            cos(radians(COALESCE(user.longitude, profile.longitude)) - radians(:customerLng)) +
            sin(radians(:customerLat)) *
            sin(radians(COALESCE(user.latitude, profile.latitude)))
          ))
        )
      ) <= :radiusKm
    )`,
    { customerLat: latitude, customerLng: longitude, radiusKm }
  );
}

module.exports = {
  DEFAULT_MARKETPLACE_RADIUS_KM,
  parseCoords,
  resolveCustomerCoords,
  parseRadiusKm,
  applyNearbyOwnerFilter,
  applyNearbyStoreProfileFilter,
};
