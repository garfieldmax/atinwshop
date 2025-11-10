export default function handler(req, res) {
  res.status(200).json({
    message: 'Supabase Proximity GPS API',
    endpoints: {
      'POST /api/location/update': 'Update user location and check for nearby users',
      'GET /api/location/nearby': 'Get nearby users for a given location',
      'DELETE /api/cleanup': 'Remove stale location records (cron job)'
    },
    documentation: 'See README.md for setup and usage instructions'
  })
}

