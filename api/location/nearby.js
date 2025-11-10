import supabase from '../../lib/supabase.js'

const MAX_DISTANCE_METERS = 100
const USER_ID_REGEX = /^[A-Za-z0-9_-]{3,128}$/

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, lat, lng } = req.query

    if (!USER_ID_REGEX.test(userId || '')) {
      return res.status(400).json({ error: 'Invalid userId format' })
    }

    const latitude = Number(lat)
    const longitude = Number(lng)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ error: 'Latitude and longitude are required' })
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

    return res.status(200).json({ users: nearbyUsers || [] })
  } catch (error) {
    console.error('Nearby lookup failed', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
