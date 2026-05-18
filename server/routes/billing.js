const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../db/supabase');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/create-checkout', authMiddleware, async (req, res) => {
  try {
    if (req.user?.isGuest) {
      return res.status(403).json({ error: 'Guests cannot upgrade to Pro' });
    }

    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID || !process.env.CLIENT_URL) {
      return res.status(500).json({ error: 'Billing is not configured' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: req.user.email,
      success_url: `${process.env.CLIENT_URL}/profile?upgraded=true`,
      cancel_url: `${process.env.CLIENT_URL}/profile`,
      metadata: { userId: req.user.id },
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('create-checkout failed:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

const webhook = async (req, res) => {
  const signature = req.headers['stripe-signature'];

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send('Webhook secret is not configured');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Stripe webhook signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session?.metadata?.userId;

      if (userId) {
        await supabase
          .from('users')
          .update({ is_pro: true, stripe_customer_id: session.customer })
          .eq('id', userId);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;

      if (subscription?.customer) {
        await supabase
          .from('users')
          .update({ is_pro: false })
          .eq('stripe_customer_id', subscription.customer);
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Stripe webhook handling failed:', error);
    return res.sendStatus(500);
  }
};

router.webhook = webhook;

module.exports = router;