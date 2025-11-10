import supabase from '../lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { error } = await supabase.rpc('cleanup_stale_locations')

    if (error) {
      throw error
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Cleanup job failed', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
