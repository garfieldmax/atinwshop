import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import supabase from '../lib/supabase.js'

const app = new Hono().basePath('/api')

// Maximum allowed distance in meters before triggering alerts
const MAX_DISTANCE_METERS = 100
// Maximum acceptable GPS accuracy in meters
const MAX_GPS_ACCURACY = 50
// Number of consecutive proximity detections required before alerting
const CONSECUTIVE_THRESHOLD = 2
// Simple user identifier validation to avoid abusing the service role key
const USER_ID_REGEX = /^[A-Za-z0-9_-]{3,128}$/

// Root endpoint - API info
app.get('/', (c) => {
  return c.json({
    message: 'Supabase Proximity GPS API',
    endpoints: {
      'POST /api/location/update': 'Update user location and check for nearby users',
      'GET /api/location/nearby': 'Get nearby users for a given location',
      'DELETE /api/cleanup': 'Remove stale location records (cron job)'
    },
    documentation: 'See README.md for setup and usage instructions'
  })
})

// POST /api/location/update - Update user location
app.post('/location/update', async (c) => {
  try {
    const body = await c.req.json()
    const { userId, lat, lng, accuracy } = body

    if (!USER_ID_REGEX.test(userId || '')) {
      return c.json({ success: false, error: 'Invalid userId format' }, 400)
    }

    const latitude = Number(lat)
    const longitude = Number(lng)
    const gpsAccuracy = accuracy != null ? Number(accuracy) : null

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return c.json({ success: false, error: 'Latitude and longitude are required' }, 400)
    }

    if (gpsAccuracy != null && gpsAccuracy > MAX_GPS_ACCURACY) {
      // Ignore low quality GPS fixes to preserve proximity signal quality
      return c.json({
        success: false,
        message: 'Location ignored due to poor accuracy',
        nearby: []
      })
    }

    // Read the current proximity counters so we can apply tolerance rules
    const { data: existingRecord, error: readError } = await supabase
      .from('locations')
      .select('proximity_count, last_notified_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (readError) {
      throw readError
    }

    const nowIso = new Date().toISOString()

    // Upsert the location with the latest coordinates
    const { error: upsertError } = await supabase
      .from('locations')
      .upsert({
        user_id: userId,
        coordinates: `SRID=4326;POINT(${longitude} ${latitude})`,
        last_updated: nowIso,
        proximity_count: existingRecord?.proximity_count ?? 0,
        last_notified_at: existingRecord?.last_notified_at ?? null
      })

    if (upsertError) {
      throw upsertError
    }

    // Query for nearby users using the Postgres function that applies the Haversine formula
    const { data: nearbyUsers, error: nearbyError } = await supabase.rpc('nearby_locations', {
      query_lat: latitude,
      query_lng: longitude,
      radius_m: MAX_DISTANCE_METERS,
      exclude_user: userId,
      inactive_after_seconds: 120,
      limit_results: 10
    })

    if (nearbyError) {
      throw nearbyError
    }

    const proximityDetected = (nearbyUsers?.length || 0) > 0
    const currentCount = existingRecord?.proximity_count ?? 0
    const updatedCount = proximityDetected ? Math.min(currentCount + 1, CONSECUTIVE_THRESHOLD) : 0

    let shouldNotify = false
    let newLastNotifiedAt = existingRecord?.last_notified_at ?? null

    if (proximityDetected && updatedCount >= CONSECUTIVE_THRESHOLD) {
      const previousNotificationTime = existingRecord?.last_notified_at ? new Date(existingRecord.last_notified_at) : null
      const notificationCooldownMs = 60 * 1000
      const now = Date.now()

      if (!previousNotificationTime || now - previousNotificationTime.getTime() > notificationCooldownMs) {
        shouldNotify = true
        newLastNotifiedAt = new Date(now).toISOString()
      }
    }

    // Persist the updated tolerance counters
    const { error: updateCountersError } = await supabase
      .from('locations')
      .update({
        proximity_count: updatedCount,
        last_notified_at: newLastNotifiedAt
      })
      .eq('user_id', userId)

    if (updateCountersError) {
      throw updateCountersError
    }

    // Note: Push notifications removed - use Supabase Realtime subscriptions instead
    // Clients can subscribe to the 'locations' table to get real-time proximity updates

    return c.json({
      success: true,
      nearby: nearbyUsers || [],
      proximityCount: updatedCount,
      notified: shouldNotify
    })
  } catch (error) {
    console.error('Location update error', error)
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})

// GET /api/location/nearby - Get nearby users
app.get('/location/nearby', async (c) => {
  try {
    const { userId, lat, lng } = c.req.query()

    if (!USER_ID_REGEX.test(userId || '')) {
      return c.json({ error: 'Invalid userId format' }, 400)
    }

    const latitude = Number(lat)
    const longitude = Number(lng)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return c.json({ error: 'Latitude and longitude are required' }, 400)
    }

    const { data: nearbyUsers, error } = await supabase.rpc('nearby_locations', {
      query_lat: latitude,
      query_lng: longitude,
      radius_m: MAX_DISTANCE_METERS,
      exclude_user: userId,
      inactive_after_seconds: 120,
      limit_results: 10
    })

    if (error) {
      throw error
    }

    return c.json({ users: nearbyUsers || [] })
  } catch (error) {
    console.error('Nearby lookup failed', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /api/cleanup - Cleanup stale locations (cron job)
app.delete('/cleanup', async (c) => {
  try {
    const { error } = await supabase.rpc('cleanup_stale_locations')

    if (error) {
      throw error
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Cleanup job failed', error)
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})

export default handle(app)

