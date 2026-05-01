const supabase = require('../config/supabase.config')

async function incrementUsage(userId, field, amount = 1) {
  try {
    const { data, error } = await supabase
      .from('user_usage')
      .select(field)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      console.warn(`[usageHelper] no usage record found for user=${userId}`)
      return
    }

    const { error: updateError } = await supabase
      .from('user_usage')
      .update({ [field]: (data[field] || 0) + amount, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (updateError) {
      console.error(`[usageHelper] failed to increment ${field} for user=${userId}:`, updateError.message)
    }
  } catch (err) {
    console.error(`[usageHelper] unexpected error for user=${userId}:`, err.message)
  }
}

module.exports = { incrementUsage }
