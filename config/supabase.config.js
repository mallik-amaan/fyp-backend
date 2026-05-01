const supabase = require("@supabase/supabase-js")

const supabaseClient = supabase.createClient(
    process.env.SUPABASE_URL,
    process.env.SERVICE_ROLE_KEY
)

module.exports = supabaseClient