import { createClient } from '@supabase/supabase-js'

// Initialize a single Supabase client using service role credentials.
// Serverless functions reuse this instance thanks to Node.js module caching.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default supabase
