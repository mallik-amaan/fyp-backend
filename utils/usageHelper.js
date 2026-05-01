const supabase = require('../config/supabase.config')

async function maybeResetPeriod(userId) {
  try {
    const { data, error } = await supabase
      .from('user_usage')
      .select('period_start')
      .eq('user_id', userId)
      .single()

    if (error || !data) return

    const daysSinceReset = (Date.now() - new Date(data.period_start).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceReset < 30) return

    await supabase
      .from('user_usage')
      .update({
        generation_requests_used: 0,
        redactions_used: 0,
        docs_generated_used: 0,
        period_start: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    console.log(`[usageHelper] monthly reset for user=${userId} (${Math.floor(daysSinceReset)}d since last reset)`)
  } catch (err) {
    console.error(`[usageHelper] maybeResetPeriod error for user=${userId}:`, err.message)
  }
}

async function checkUsageLimit(userId, field, limitField, amount = 1) {
  await maybeResetPeriod(userId)

  try {
    const { data, error } = await supabase
      .from('user_usage')
      .select(`${field}, plans(${limitField})`)
      .eq('user_id', userId)
      .single()

    if (error || !data) return { allowed: true }

    const used = data[field] || 0
    const limit = data.plans?.[limitField] || 0
    return { allowed: used + amount <= limit, used, limit }
  } catch (err) {
    console.error(`[usageHelper] checkUsageLimit error for user=${userId}:`, err.message)
    return { allowed: true }
  }
}

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

module.exports = { maybeResetPeriod, checkUsageLimit, incrementUsage }
