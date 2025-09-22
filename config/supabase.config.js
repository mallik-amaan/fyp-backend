const supabase = require("@supabase/supabase-js")

const supabaseClient = supabase.createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PASSWORD,
)

module.exports = supabaseClient