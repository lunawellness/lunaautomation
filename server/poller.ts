import cron from "node-cron";
import { storage } from "./storage";
import { getRecentReviews, matchReviewToClient, refreshAccessToken } from "./google-reviews";
import { applyAccountCredit } from "./mindbody";
import { sendStaffCreditNotification, sendCreditConfirmationEmail } from "./email";

let pollerRunning = false;

export async function runReviewPoller() {
  if (pollerRunning) return;
  pollerRunning = true;

  try {
    console.log("[Poller] Checking Google Business Profile for new reviews...");

    // Refresh access token if needed
    await refreshAccessToken();

    const reviews = await getRecentReviews(50);
    if (!reviews.length) {
      console.log("[Poller] No reviews returned from GBP.");
      return;
    }

    // Get all clients with pending credit
    const pendingClients = storage.getClientsWithPendingCredit();
    if (!pendingClients.length) {
      console.log("[Poller] No clients with pending credit.");
      return;
    }

    console.log(`[Poller] ${reviews.length} reviews, ${pendingClients.length} clients pending credit.`);

    for (const review of reviews) {
      // Only interested in 5-star reviews
      if (review.starRating !== "FIVE") continue;

      const reviewerName = review.reviewer?.displayName || "";
      const reviewTime = review.createTime || review.updateTime;

      // Only look at recent reviews (last 30 days)
      if (reviewTime) {
        const reviewDate = new Date(reviewTime);
        const now = new Date();
        const diffDays = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 30) continue;
      }

      const matchedClient = matchReviewToClient(reviewerName, pendingClients);
      if (!matchedClient) continue;

      console.log(`[Poller] Matched review from "${reviewerName}" to client ${matchedClient.firstName} ${matchedClient.lastName}`);

      // Apply $25 credit in MINDBODY
      const creditApplied = await applyAccountCredit({
        mindbodyClientId: matchedClient.mindbodyClientId,
        amount: 25,
        note: `Google review reward — "${review.comment?.substring(0, 100) || ''}"`,
      });

      const now = new Date().toISOString();

      // Update client record
      storage.updateClient(matchedClient.id, {
        creditApplied: creditApplied,
        creditPending: false,
        creditAppliedAt: now,
        reviewDetectedAt: now,
        reviewText: review.comment?.substring(0, 500) || null,
      });

      // Log the event
      storage.addLog({
        clientId: matchedClient.id,
        mindbodyClientId: matchedClient.mindbodyClientId,
        event: creditApplied ? "credit_applied" : "credit_failed_mindbody_not_configured",
        details: JSON.stringify({
          reviewerName,
          reviewStars: review.starRating,
          reviewText: review.comment?.substring(0, 200),
          creditAmount: 25,
          creditApplied,
        }),
        createdAt: now,
      });

      // Send credit confirmation + rebooking email to client
      const bookingUrl = storage.getSetting("booking_url") || "https://www.lunawellnesscentre.ca/book";
      const creditEmailSent = await sendCreditConfirmationEmail({
        firstName: matchedClient.firstName,
        email: matchedClient.email,
        serviceName: matchedClient.serviceName || "Float Session",
        bookingUrl,
      });

      if (creditEmailSent) {
        storage.updateClient(matchedClient.id, { creditConfirmationEmailSentAt: now });
        storage.addLog({
          clientId: matchedClient.id,
          mindbodyClientId: matchedClient.mindbodyClientId,
          event: "credit_confirmation_email_sent",
          details: JSON.stringify({ to: matchedClient.email, bookingUrl }),
          createdAt: now,
        });
      }

      // Notify staff
      const notified = await sendStaffCreditNotification({
        clientFirstName: matchedClient.firstName,
        clientLastName: matchedClient.lastName,
        clientEmail: matchedClient.email,
        reviewText: review.comment?.substring(0, 200),
      });

      if (notified) {
        storage.updateClient(matchedClient.id, { staffNotifiedAt: now });
      }

      console.log(`[Poller] Credit ${creditApplied ? "applied" : "logged (MINDBODY pending setup)"} for ${matchedClient.firstName} ${matchedClient.lastName}`);
    }
  } catch (err) {
    console.error("[Poller] Error:", err);
  } finally {
    pollerRunning = false;
  }
}

// Run every 30 minutes
export function startPoller() {
  console.log("[Poller] Starting 30-minute review poller...");
  cron.schedule("*/30 * * * *", runReviewPoller);
}
