const axios = require('axios');

function toNumericCoordinates({ startLng, startLat, endLng, endLat }) {
  const sLng = Number(startLng);
  const sLat = Number(startLat);
  const eLng = Number(endLng);
  const eLat = Number(endLat);

  const isValidCoordinate =
    Number.isFinite(sLng) &&
    Number.isFinite(sLat) &&
    Number.isFinite(eLng) &&
    Number.isFinite(eLat) &&
    sLat >= -90 &&
    sLat <= 90 &&
    eLat >= -90 &&
    eLat <= 90 &&
    sLng >= -180 &&
    sLng <= 180 &&
    eLng >= -180 &&
    eLng <= 180;

  return {
    isValidCoordinate,
    sLng,
    sLat,
    eLng,
    eLat
  };
}

function mapOrsRoute(route) {
  const summary = route.summary || {};
  return {
    distance: summary.distance ?? 0,
    duration: summary.duration ?? 0,
    geometry: route.geometry ?? '',
    bbox: route.bbox || null,
    segments: (route.segments || []).map((segment) => ({
      distance: segment.distance ?? 0,
      duration: segment.duration ?? 0,
      steps: (segment.steps || []).map((step) => ({
        instruction: step.instruction || '',
        distance: step.distance ?? 0,
        duration: step.duration ?? 0,
        type: step.type ?? 0,
        name: step.name || ''
      }))
    }))
  };
}

function mapOsrmRoute(route) {
  const steps = (route.legs || []).flatMap((leg) =>
    (leg.steps || []).map((step) => {
      const maneuverType = step.maneuver?.type || '';
      const maneuverModifier = step.maneuver?.modifier || '';
      const readableInstruction =
        [maneuverType, maneuverModifier, step.name].filter(Boolean).join(' ') ||
        step.name ||
        'Continue';
      return {
        instruction: readableInstruction,
        distance: step.distance ?? 0,
        duration: step.duration ?? 0,
        type: 0,
        name: step.name || ''
      };
    })
  );

  return {
    distance: route.distance ?? 0,
    duration: route.duration ?? 0,
    geometry: route.geometry ?? '',
    bbox: null,
    segments: [
      {
        distance: route.distance ?? 0,
        duration: route.duration ?? 0,
        steps
      }
    ]
  };
}

async function fetchFromOpenRouteService({ sLng, sLat, eLng, eLat, apiKey }) {
  const response = await axios.post(
    'https://api.openrouteservice.org/v2/directions/driving-car',
    {
      coordinates: [
        [sLng, sLat],
        [eLng, eLat]
      ]
    },
    {
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    }
  );

  const route = response?.data?.routes?.[0];
  if (!route) throw new Error('OpenRouteService returned no route');
  return mapOrsRoute(route);
}

async function fetchFromOsrm({ sLng, sLat, eLng, eLat }) {
  const response = await axios.get(
    `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}`,
    {
      params: {
        overview: 'full',
        geometries: 'polyline',
        steps: true
      },
      timeout: 10000
    }
  );

  const route = response?.data?.routes?.[0];
  if (!route) throw new Error('OSRM returned no route');
  return mapOsrmRoute(route);
}

/**
 * Get directions between two points.
 * Primary source: OpenRouteService.
 * Fallback source: OSRM public API.
 * POST /api/routing/directions
 */
async function getDirections(req, res) {
  try {
    const { startLng, startLat, endLng, endLat } = req.body;

    // Validate coordinates (allow 0 values, reject missing/invalid)
    if (
      startLng == null || startLat == null || endLng == null || endLat == null
    ) {
      return res.status(400).json({ 
        error: 'Missing coordinates. Required: startLng, startLat, endLng, endLat' 
      });
    }

    const { isValidCoordinate, sLng, sLat, eLng, eLat } = toNumericCoordinates({
      startLng,
      startLat,
      endLng,
      endLat
    });

    if (!isValidCoordinate) {
      return res.status(400).json({
        error: 'Invalid coordinates. Coordinates must be valid numeric latitude/longitude values.'
      });
    }

    const apiKey = process.env.OPENROUTESERVICE_API_KEY;

    let routeData = null;
    let source = 'openrouteservice';
    let orsError = null;

    if (apiKey) {
      try {
        routeData = await fetchFromOpenRouteService({ sLng, sLat, eLng, eLat, apiKey });
      } catch (error) {
        orsError = error;
        source = 'osrm-fallback';
      }
    } else {
      source = 'osrm-fallback';
    }

    if (!routeData) {
      try {
        routeData = await fetchFromOsrm({ sLng, sLat, eLng, eLat });
      } catch (osrmError) {
        console.error('Routing error (ORS + OSRM):', {
          ors: orsError?.response?.data || orsError?.message,
          osrm: osrmError?.response?.data || osrmError?.message
        });
        const status = osrmError?.response?.status || orsError?.response?.status || 500;
        return res.status(status).json({
          error: 'Failed to get directions',
          details:
            osrmError?.response?.data?.message ||
            osrmError?.message ||
            orsError?.response?.data?.error?.message ||
            orsError?.message ||
            'Unknown routing error'
        });
      }
    }

    return res.json({
      success: true,
      source,
      data: routeData
    });
  } catch (error) {
    console.error('Routing error:', error.response?.data || error.message);
    const upstreamStatus = error.response?.status;
    return res
      .status(upstreamStatus && upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 500)
      .json({ 
      error: 'Failed to get directions',
      details: error.response?.data?.error?.message || error.message
    });
  }
}

/**
 * Get distance matrix between multiple points
 * POST /api/routing/distance-matrix
 */
async function getDistanceMatrix(req, res) {
  try {
    const { locations } = req.body;

    if (!locations || !Array.isArray(locations) || locations.length < 2) {
      return res.status(400).json({ 
        error: 'Locations array with at least 2 points required' 
      });
    }

    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenRouteService API key not configured' 
      });
    }

    const response = await axios.post(
      'https://api.openrouteservice.org/v2/matrix/driving-car',
      {
        locations: locations.map(loc => [loc.lng, loc.lat]),
        metrics: ['distance', 'duration']
      },
      {
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Distance matrix error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to get distance matrix',
      details: error.response?.data?.error?.message || error.message
    });
  }
}

/**
 * Geocode an address to coordinates
 * POST /api/routing/geocode
 */
async function geocodeAddress(req, res) {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'OpenRouteService API key not configured' 
      });
    }

    const response = await axios.get(
      'https://api.openrouteservice.org/geocode/search',
      {
        params: {
          text: address,
          size: 5
        },
        headers: {
          Authorization: apiKey
        },
        timeout: 10000
      }
    );

    res.json({
      success: true,
      data: response.data.features.map(feature => ({
        name: feature.properties.name,
        label: feature.properties.label,
        coordinates: feature.geometry.coordinates,
        confidence: feature.properties.confidence
      }))
    });
  } catch (error) {
    console.error('Geocoding error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to geocode address',
      details: error.response?.data?.error?.message || error.message
    });
  }
}

module.exports = {
  getDirections,
  getDistanceMatrix,
  geocodeAddress
};
