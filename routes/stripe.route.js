const express = require('express')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const supabase = require('../config/supabase.config')

const router = express.Router()

const PLAN_PRICES = {
  pro: { name: 'DocSynth Pro', amount: 1000, currency: 'usd' },
  max: { name: 'DocSynth Max', amount: 5000, currency: 'usd' },
}

// POST /stripe/create-checkout-session
router.post('/create-checkout-session', async (req, res) => {
  const { userId, planName } = req.body
  console.log(`[stripe] checkout session request userId=${userId} planName=${planName}`)

  if (!userId || !planName || !PLAN_PRICES[planName]) {
    return res.status(400).json({ error: 'Invalid userId or planName' })
  }

  const plan = PLAN_PRICES[planName]
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: plan.currency,
          product_data: { name: plan.name },
          unit_amount: plan.amount,
        },
        quantity: 1,
      }],
      metadata: { userId: String(userId), planName },
      success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/usage`,
    })

    console.log(`[stripe] session created id=${session.id} userId=${userId}`)
    res.json({ url: session.url })
  } catch (err) {
    console.error('[stripe] checkout error:', err.message)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// POST /stripe/webhook  (raw body — see index.js)
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe] webhook signature error:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { userId, planName } = session.metadata

    console.log(`[stripe] checkout.session.completed userId=${userId} planName=${planName}`)

    try {
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('id')
        .eq('name', planName)
        .single()

      if (planError || !plan) {
        console.error('[stripe] plan not found:', planName)
      } else {
        const { error: updateError } = await supabase
          .from('user_usage')
          .update({
            plan_id: plan.id,
            period_start: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        if (updateError) {
          console.error('[stripe] plan upgrade DB error:', updateError.message)
        } else {
          console.log(`[stripe] plan upgraded userId=${userId} → ${planName}`)
        }
      }
    } catch (err) {
      console.error('[stripe] webhook handler error:', err.message)
    }
  }

  res.json({ received: true })
})

module.exports = router
