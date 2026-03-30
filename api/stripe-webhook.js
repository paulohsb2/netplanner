/**
 * Vercel Serverless Function — Webhook Stripe
 * POST /api/stripe-webhook
 * Atualiza o plano do usuário no Supabase quando uma assinatura é ativada/cancelada
 */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Supabase client com service role (acesso total, sem RLS)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // configurar no Vercel
);

// Mapeia price ID → plano
const PRICE_TO_PLAN = {
  [process.env.STRIPE_PRICE_BASIC      || "price_1TGgnbGeCkGLlIw1s3i3ObJ7"]: "basic",
  [process.env.STRIPE_PRICE_PRO        || "price_1TGgnuGeCkGLlIw1577Uoz61"]: "pro",
  [process.env.STRIPE_PRICE_ENTERPRISE || "price_1TGgoEGeCkGLlIw1zPimEU9V"]: "enterprise",
};

export const config = {
  api: { bodyParser: false }, // necessário para verificar assinatura Stripe
};

async function buffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const priceId = session.metadata?.priceId;
        const plan = PRICE_TO_PLAN[priceId] || "basic";
        const customerId = session.customer;

        if (userId) {
          await supabase.from("profiles").update({
            plan,
            stripe_customer_id: customerId,
            subscription_status: "active",
          }).eq("id", userId);
          console.log(`✅ User ${userId} upgraded to ${plan}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customerId = sub.customer;
        const status = sub.status; // "active" | "past_due" | "canceled"
        const priceId = sub.items?.data?.[0]?.price?.id;
        const plan = PRICE_TO_PLAN[priceId] || "basic";
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

        await supabase.from("profiles").update({
          plan: status === "active" ? plan : "free",
          subscription_status: status,
          subscription_end: periodEnd,
        }).eq("stripe_customer_id", customerId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = sub.customer;
        await supabase.from("profiles").update({
          plan: "free",
          subscription_status: "cancelled",
          subscription_end: null,
        }).eq("stripe_customer_id", customerId);
        console.log(`⚠️ Subscription cancelled for customer ${customerId}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        await supabase.from("profiles").update({
          subscription_status: "past_due",
        }).eq("stripe_customer_id", customerId);
        break;
      }

      default:
        // Evento não tratado — ok
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: err.message });
  }

  return res.status(200).json({ received: true });
}
