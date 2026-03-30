/**
 * Vercel Serverless Function — Criar sessão de checkout Stripe
 * POST /api/create-checkout-session
 * Body: { priceId, userId, email }
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Mapeia os price IDs dos planos Stripe
const PRICE_IDS = {
  price_basic:      process.env.STRIPE_PRICE_BASIC      || "price_1TGgnbGeCkGLlIw1s3i3ObJ7",
  price_pro:        process.env.STRIPE_PRICE_PRO        || "price_1TGgnuGeCkGLlIw1577Uoz61",
  price_enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "price_1TGgoEGeCkGLlIw1zPimEU9V",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { priceId, userId, email } = req.body;

  if (!priceId || !userId || !email) {
    return res.status(400).json({ error: "Missing priceId, userId or email" });
  }

  const resolvedPriceId = PRICE_IDS[priceId] || priceId;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: `${process.env.VITE_APP_URL || "https://netplanner.vercel.app"}/?session_id={CHECKOUT_SESSION_ID}&subscribed=true`,
      cancel_url: `${process.env.VITE_APP_URL || "https://netplanner.vercel.app"}/?cancelled=true`,
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId },
      },
      metadata: { userId, priceId },
      allow_promotion_codes: true,
      locale: "pt-BR",
    }, {
      idempotencyKey: `checkout-${userId}-${resolvedPriceId}-${Math.floor(Date.now() / 60000)}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({ error: err.message });
  }
}
