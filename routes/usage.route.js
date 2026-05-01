const express = require('express')
const supabase = require('../config/supabase.config')
const { maybeResetPeriod } = require('../utils/usageHelper')
const router = express.Router()

// GET /usage/:userId
router.get('/:userId', async (req, res) => {
  const { userId } = req.params
  if (!userId) return res.status(400).json({ result: false, message: 'userId is required' })

  try {
    await maybeResetPeriod(userId)

    const { data, error } = await supabase
      .from('user_usage')
      .select(`
        generation_requests_used,
        redactions_used,
        docs_generated_used,
        period_start,
        period_end,
        plans (
          name,
          display_name,
          price_monthly,
          generation_requests_limit,
          redactions_limit,
          docs_generated_limit
        )
      `)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      console.error('[usage] fetch error:', error?.message)
      return res.status(404).json({ result: false, message: 'Usage data not found' })
    }

    res.json({
      result: true,
      plan: {
        name: data.plans.name,
        display_name: data.plans.display_name,
        price_monthly: data.plans.price_monthly,
        limits: {
          generation_requests: data.plans.generation_requests_limit,
          redactions: data.plans.redactions_limit,
          docs_generated: data.plans.docs_generated_limit,
        },
      },
      usage: {
        generation_requests_used: data.generation_requests_used,
        redactions_used: data.redactions_used,
        docs_generated_used: data.docs_generated_used,
      },
      period_start: data.period_start,
      period_end: data.period_end,
    })
  } catch (err) {
    console.error('[usage] unexpected error:', err)
    res.status(500).json({ result: false, message: 'Failed to fetch usage' })
  }
})

module.exports = router
