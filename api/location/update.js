import supabase from '../../lib/supabase.js'
import { sendProximityAlert } from '../../lib/notifications.js'

// Maximum allowed distance in meters before triggering alerts
const MAX_DISTANCE_METERS = 100
// Maximum acceptable GPS accuracy in meters
const MAX_GPS_ACCURACY = 50
// Number of consecutive proximity detections required before alerting
const CONSECUTIVE_THRESHOLD = 2

// Simple user identifier validation to avoid abusing the service role key
const USER_ID_REGEX = /^[A-Za-z0-9_-]{3,128}$/

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { userId, lat, lng, accuracy } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}

    if (!USER_ID_REGEX.test(userId || '')) {
      return res.status(400).json({ success: false, error: 'Invalid userId format' })
    }

    const latitude = Number(lat)
    const longitude = Number(lng)
    const gpsAccuracy = accuracy != null ? Number(accuracy) : null

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ success: false, error: 'Latitude and longitude are required' })
    }

    if (gpsAccuracy != null && gpsAccuracy > MAX_GPS_ACCURACY) {
      // Ignore low quality GPS fixes to preserve proximity signal quality
      return res.status(200).json({
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

    if (shouldNotify) {
      try {
        await sendProximityAlert(userId, nearbyUsers)
      } catch (notificationError) {
        console.error('Failed to send proximity alert', notificationError)
      }
    }

    return res.status(200).json({
      success: true,
      nearby: nearbyUsers || [],
      proximityCount: updatedCount,
      notified: shouldNotify
    })
  } catch (error) {
    console.error('Location update error', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
