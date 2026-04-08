import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = admin.firestore();

let stripeClient: Stripe | null = null;

function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      // We don't throw here to allow the server to start, 
      // but we will throw when an actual Stripe operation is attempted.
      return null;
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe Webhook (must be before express.json())
  app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = getStripe();

    if (!stripe) {
      console.error("Stripe key missing. Webhook ignored.");
      return res.status(500).send("Stripe configuration missing");
    }

    let event;

    try {
      if (endpointSecret && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } else {
        event = JSON.parse(req.body);
      }
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;

      if (userId) {
        const updateData: any = {
          hasPaid: true,
          paymentDate: Date.now(),
          stripeSessionId: session.id,
        };

        if (session.subscription) {
          updateData.subscriptionId = session.subscription as string;
          updateData.subscriptionStatus = 'active';
        }

        try {
          await db.collection("users").doc(userId).set(updateData, { merge: true });
          console.log(`User ${userId} marked as paid.`);
        } catch (error) {
          console.error(`Error updating user ${userId}:`, error);
        }
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.userId;

      if (userId) {
        const status = subscription.status;
        try {
          await db.collection("users").doc(userId).update({
            subscriptionStatus: status,
            hasPaid: status === 'active' || status === 'trialing',
          });
          console.log(`Subscription for user ${userId} updated to ${status}.`);
        } catch (error) {
          console.error(`Error updating subscription for user ${userId}:`, error);
        }
      } else {
        // Fallback: find by subscriptionId
        const snapshot = await db.collection("users").where("subscriptionId", "==", subscription.id).get();
        if (!snapshot.empty) {
          const status = subscription.status;
          await snapshot.docs[0].ref.update({
            subscriptionStatus: status,
            hasPaid: status === 'active' || status === 'trialing',
          });
        }
      }
    }

    res.json({ received: true });
  });

  app.use(express.json());

  // Create Stripe Checkout Session
  app.post("/api/create-checkout-session", async (req, res) => {
    const { userId, email, plan } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const stripe = getStripe();
    if (!stripe) {
      return res.status(500).json({ error: "Stripe is not configured. Please add STRIPE_SECRET_KEY to environment variables." });
    }

    const isSubscription = plan === 'monthly' || plan === 'annual';
    const unitAmount = plan === 'annual' ? 8999 : (plan === 'monthly' ? 999 : 4999);
    const interval = plan === 'annual' ? 'year' : 'month';

    try {
      const sessionOptions: any = {
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `MiroFish Pro - ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
                description: isSubscription 
                  ? `Recurring ${plan} subscription for full access.`
                  : "One-time access pass for simulations and foresight reports.",
              },
              unit_amount: unitAmount,
              ...(isSubscription && {
                recurring: {
                  interval: interval,
                },
              }),
            },
            quantity: 1,
          },
        ],
        mode: isSubscription ? "subscription" : "payment",
        success_url: `${req.headers.origin}/?payment=success`,
        cancel_url: `${req.headers.origin}/?payment=cancel`,
        client_reference_id: userId,
        customer_email: email,
        ...(isSubscription && {
          subscription_data: {
            metadata: { userId }
          }
        })
      };

      const session = await stripe.checkout.sessions.create(sessionOptions);
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
