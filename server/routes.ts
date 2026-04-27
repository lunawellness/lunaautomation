import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { sendFeedbackEmail, sendReviewRequestEmail, sendCreditConfirmationEmail } from "./email";
import { isFirstVisit, testConnection, applyAccountCredit } from "./mindbody";
import { runReviewPoller } from "./poller";

export async function registerRoutes(httpServer: Server, app: Express) {

  // ─── MINDBODY WEBHOOK ─────────────────────────────────────────────────────
  // MINDBODY posts here when any appointment is booked/completed
  app.post("/api/webhook/mindbody", async (req: Request, res: Response) => {
    // Respond immediately so MINDBODY doesn't timeout
    res.status(200).json({ received: true });

    try {
      const body = req.body;
      const eventType = body?.messageType || body?.EventType || "";
      const clientData = body?.client || body?.Client || {};
      const appointmentData = body?.appointment || body?.Appointment || {};

      const mindbodyClientId = String(clientData?.Id || clientData?.ClientId || "");
      const firstName = clientData?.FirstName || "";
      const lastName = clientData?.LastName || "";
      const email = clientData?.Email || clientData?.EmailAddress || "";
      const serviceName = appointmentData?.SessionTypeName || appointmentData?.ServiceName || "your session";

      storage.addLog({
        mindbodyClientId,
        clientId: null,
        event: "webhook_received",
        details: JSON.stringify({ eventType, firstName, lastName, email, serviceName }),
        createdAt: new Date().toISOString(),
      });

      if (!mindbodyClientId || !email) {
        console.log("[Webhook] Missing clientId or email — skipping");
        return;
      }

      // Check if already processed
      const existing = storage.getClientByMindbodyId(mindbodyClientId);
      if (existing) {
        console.log(`[Webhook] Client ${mindbodyClientId} already in system — skipping`);
        return;
      }

      // Check if this is their first visit via MINDBODY API
      // If MINDBODY API not yet configured, we trust the webhook (good for testing)
      const mbApiKey = storage.getSetting("mindbody_api_key");
      let firstVisit = true;
      if (mbApiKey) {
        firstVisit = await isFirstVisit(mindbodyClientId);
      }

      if (!firstVisit) {
        console.log(`[Webhook] Not a first visit for client ${mindbodyClientId}`);
        return;
      }

      // Create client record
      const now = new Date().toISOString();
      const client = storage.createClient({
        mindbodyClientId,
        firstName,
        lastName,
        email,
        serviceName,
        visitDate: now,
        createdAt: now,
      });

      storage.addLog({
        clientId: client.id,
        mindbodyClientId,
        event: "first_visit_confirmed",
        details: JSON.stringify({ firstName, lastName, email, serviceName }),
        createdAt: now,
      });

      // Wait 1 hour then send feedback email
      const delayMs = 60 * 60 * 1000; // 1 hour
      // For testing: use 10 seconds if TEST_MODE is set
      const actualDelay = process.env.TEST_MODE === "true" ? 10_000 : delayMs;

      setTimeout(async () => {
        const sent = await sendFeedbackEmail({
          clientId: client.id,
          mindbodyClientId,
          firstName,
          email,
          serviceName,
        });

        const sentAt = new Date().toISOString();
        if (sent) {
          storage.updateClient(client.id, { feedbackEmailSentAt: sentAt });
          storage.addLog({
            clientId: client.id, mindbodyClientId,
            event: "feedback_email_sent",
            details: JSON.stringify({ to: email }),
            createdAt: sentAt,
          });
        } else {
          storage.addLog({
            clientId: client.id, mindbodyClientId,
            event: "feedback_email_failed",
            details: "SendGrid error",
            createdAt: sentAt,
          });
        }
      }, actualDelay);

      console.log(`[Webhook] First visit confirmed for ${firstName} ${lastName}. Email scheduled in ${actualDelay / 1000}s.`);
    } catch (err) {
      console.error("[Webhook] Error processing MINDBODY webhook:", err);
    }
  });

  // ─── STAR RATING CLICK ───────────────────────────────────────────────────
  // Client clicks a star in their email — this URL is hit
  app.get("/api/rate", async (req: Request, res: Response) => {
    const { client_id, rating } = req.query as { client_id: string; rating: string };
    const ratingNum = parseInt(rating, 10);

    if (!client_id || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).send("Invalid rating link.");
    }

    const client = storage.getClientByMindbodyId(client_id);
    if (!client) {
      // Show a friendly page even if we can't find them
      return res.send(thankYouPage("", ratingNum, false));
    }

    const now = new Date().toISOString();

    // Only record rating once
    if (!client.rating) {
      storage.updateClient(client.id, { rating: ratingNum, ratedAt: now });
      storage.addLog({
        clientId: client.id, mindbodyClientId: client_id,
        event: "rating_received",
        details: JSON.stringify({ rating: ratingNum }),
        createdAt: now,
      });
    }

    if (ratingNum === 5) {
      // Send review request email if not already sent
      if (!client.reviewRequestEmailSentAt) {
        const sent = await sendReviewRequestEmail({
          clientId: client.id,
          firstName: client.firstName,
          email: client.email,
        });
        if (sent) {
          storage.updateClient(client.id, {
            reviewRequestEmailSentAt: now,
            creditPending: true,
          });
          storage.addLog({
            clientId: client.id, mindbodyClientId: client_id,
            event: "review_request_email_sent",
            details: JSON.stringify({ to: client.email }),
            createdAt: now,
          });
        }
      }
      return res.send(thankYouPage(client.firstName, 5, true));
    }

    return res.send(thankYouPage(client.firstName, ratingNum, false));
  });

  // ─── MANUAL TEST WEBHOOK ─────────────────────────────────────────────────
  // Allows testing the flow without a real MINDBODY event
  app.post("/api/test/simulate-visit", async (req: Request, res: Response) => {
    const { firstName, lastName, email, serviceName } = req.body;
    if (!firstName || !email) {
      return res.status(400).json({ error: "firstName and email required" });
    }

    const testClientId = `TEST-${Date.now()}`;
    const now = new Date().toISOString();

    const client = storage.createClient({
      mindbodyClientId: testClientId,
      firstName, lastName: lastName || "Test",
      email, serviceName: serviceName || "Float Therapy",
      visitDate: now, createdAt: now,
    });

    storage.addLog({
      clientId: client.id, mindbodyClientId: testClientId,
      event: "test_visit_simulated",
      details: JSON.stringify({ firstName, email, serviceName }),
      createdAt: now,
    });

    // Send immediately in test mode
    const sent = await sendFeedbackEmail({
      clientId: client.id, mindbodyClientId: testClientId,
      firstName, email, serviceName: serviceName || "Float Therapy",
    });

    if (sent) {
      storage.updateClient(client.id, { feedbackEmailSentAt: now });
    }

    res.json({ success: true, clientId: client.id, testClientId, emailSent: sent });
  });

  // ─── MANUAL TRIGGER: run poller now ──────────────────────────────────────
  app.post("/api/admin/run-poller", async (_req: Request, res: Response) => {
    res.json({ started: true });
    runReviewPoller();
  });

  // ─── TEST: simulate full credit flow for a client ─────────────────────────
  app.post("/api/test/simulate-credit", async (req: Request, res: Response) => {
    const { client_id } = req.body as { client_id: string };
    const client = storage.getAllClients().find(c => c.mindbodyClientId === client_id);
    if (!client) return res.status(404).json({ error: "Client not found" });

    const now = new Date().toISOString();
    const bookingUrl = storage.getSetting("booking_url") || "https://www.lunawellnesscenter.ca/float-therapy-booking";

    // Apply $25 credit in MINDBODY
    const creditApplied = await applyAccountCredit({
      mindbodyClientId: client.mindbodyClientId,
      amount: 25,
      note: "Google review reward — Luna Wellness $25 credit (test)",
    });

    // Send credit confirmation + rebooking email
    const emailSent = await sendCreditConfirmationEmail({
      firstName: client.firstName,
      email: client.email,
      serviceName: client.serviceName,
      bookingUrl,
    });

    storage.updateClient(client.id, {
      creditApplied,
      creditPending: false,
      creditAppliedAt: now,
      creditConfirmationEmailSentAt: emailSent ? now : undefined,
    });

    storage.addLog({
      clientId: client.id,
      mindbodyClientId: client.mindbodyClientId,
      event: "credit_applied",
      details: JSON.stringify({ creditApplied, emailSent, amount: 25 }),
      createdAt: now,
    });

    res.json({ success: true, creditApplied, emailSent });
  });

  // ─── MINDBODY TEST CONNECTION ─────────────────────────────────────────────
  app.post("/api/mindbody/test", async (_req: Request, res: Response) => {
    const result = await testConnection();
    res.json(result);
  });

  // ─── DASHBOARD API ────────────────────────────────────────────────────────
  app.get("/api/clients", (_req: Request, res: Response) => {
    res.json(storage.getAllClients());
  });

  app.get("/api/clients/:id", (req: Request, res: Response) => {
    const client = storage.getClientById(Number(req.params.id));
    if (!client) return res.status(404).json({ error: "Not found" });
    res.json(client);
  });

  app.get("/api/logs", (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 100;
    res.json(storage.getLogs(limit));
  });

  app.get("/api/logs/:clientId", (req: Request, res: Response) => {
    res.json(storage.getClientLogs(Number(req.params.clientId)));
  });

  app.get("/api/stats", (_req: Request, res: Response) => {
    res.json(storage.getStats());
  });

  // ─── SETTINGS API ────────────────────────────────────────────────────────
  app.get("/api/settings", (_req: Request, res: Response) => {
    const all = storage.getAllSettings();
    // Mask sensitive values
    const safe = all.map(s => ({
      ...s,
      value: s.key.includes("key") || s.key.includes("password") || s.key.includes("secret") || s.key.includes("token")
        ? s.value ? "••••••••" : ""
        : s.value,
    }));
    res.json(safe);
  });

  app.post("/api/settings", (req: Request, res: Response) => {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: "key and value required" });
    storage.setSetting(key, value);
    res.json({ success: true });
  });
}

// ─── HTML PAGES ──────────────────────────────────────────────────────────────
function thankYouPage(firstName: string, rating: number, isFiveStar: boolean): string {
  const filledStars = "★".repeat(rating);
  const emptyStars = "☆".repeat(5 - rating);
  const name = firstName ? `, ${firstName}` : "";

  const message = isFiveStar
    ? `We're so glad you had a five-star experience. We've just sent you a follow-up email with a special thank-you — check your inbox.`
    : `We appreciate your honest feedback. It helps us grow and make every visit better than the last.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Thank You — Luna Wellness Centre</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #F7F6F2;
      font-family: Arial, Helvetica, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 4px 32px rgba(0,0,0,0.10);
      max-width: 460px;
      width: 100%;
      overflow: hidden;
      text-align: center;
    }
    .header {
      background: #01696F;
      padding: 28px 32px 24px;
    }
    .header-title {
      color: #ffffff;
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .header-sub {
      color: rgba(255,255,255,0.7);
      font-size: 12px;
      margin-top: 4px;
    }
    .body {
      padding: 40px 36px 36px;
    }
    .stars {
      font-size: 52px;
      line-height: 1;
      margin-bottom: 20px;
      letter-spacing: 4px;
    }
    .stars .filled { color: #F5A623; }
    .stars .empty  { color: #D4D1CA; }
    .title {
      font-size: 22px;
      font-weight: bold;
      color: #28251D;
      margin-bottom: 14px;
    }
    .message {
      font-size: 15px;
      color: #7A7974;
      line-height: 1.7;
      margin-bottom: 32px;
    }
    .divider {
      border: none;
      border-top: 1px solid #F0EFEB;
      margin-bottom: 20px;
    }
    .footer {
      font-size: 12px;
      color: #BAB9B4;
    }
    .checkmark {
      width: 56px;
      height: 56px;
      background: #E6F3F3;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 26px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="header-title">Luna Wellness Centre</div>
      <div class="header-sub">Chilliwack, BC</div>
    </div>
    <div class="body">
      <div class="stars">
        <span class="filled">${filledStars}</span><span class="empty">${emptyStars}</span>
      </div>
      <div class="title">Thank you${name}!</div>
      <p class="message">${message}</p>
      <hr class="divider">
      <div class="footer">Luna Wellness Centre &nbsp;·&nbsp; Chilliwack, BC</div>
    </div>
  </div>
</body>
</html>`;
}
