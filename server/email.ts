import nodemailer from "nodemailer";
import { storage } from "./storage";

function getTransporter() {
  const gmailUser = storage.getSetting("gmail_user") || process.env.GMAIL_USER || "info@lunafloat.ca";
  const gmailAppPassword = storage.getSetting("gmail_app_password") || process.env.GMAIL_APP_PASSWORD || "";

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
}

function getFromEmail(): string {
  return storage.getSetting("gmail_user") || "info@lunafloat.ca";
}

function getGoogleReviewLink(): string {
  return storage.getSetting("google_review_link") || "https://g.page/r/CfqWhDXpx-B_EBM/review";
}

function getBaseUrl(): string {
  return storage.getSetting("base_url") || process.env.BASE_URL || "http://localhost:5000";
}

export async function sendFeedbackEmail(params: {
  clientId: number;
  mindbodyClientId: string;
  firstName: string;
  email: string;
  serviceName: string;
}): Promise<boolean> {
  const appPassword = storage.getSetting("gmail_app_password");
  if (!appPassword) {
    console.error("[Email] Gmail App Password not configured");
    return false;
  }

  const baseUrl = getBaseUrl();
  const makeStarUrl = (rating: number) =>
    `${baseUrl}/api/rate?client_id=${params.mindbodyClientId}&rating=${rating}`;

  const starRow = [1, 2, 3, 4, 5]
    .map(n => `<a href="${makeStarUrl(n)}" style="text-decoration:none;color:#F5A623;font-size:36px;margin:0 4px;">★</a>`)
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F6F2;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F2;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#01696F;padding:32px 40px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:1px;">LUNA WELLNESS CENTRE</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Chilliwack, BC</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:#28251D;">Hi ${params.firstName},</p>
          <p style="margin:0 0 16px;font-size:15px;color:#28251D;line-height:1.6;">Thank you for choosing Luna Wellness Centre for your <strong>${params.serviceName}</strong> today. We hope it was everything you needed — a little peace, a little reset, and a moment that was just for you.</p>
          <p style="margin:0 0 28px;font-size:15px;color:#28251D;line-height:1.6;">We'd love to hear how it went. How would you rate your experience?</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td align="center" style="padding:20px;background:#F7F6F2;border-radius:8px;">
              ${starRow}
              <p style="margin:12px 0 0;font-size:12px;color:#7A7974;">Tap a star to rate your visit</p>
            </td></tr>
          </table>
          <p style="margin:0 0 16px;font-size:15px;color:#28251D;line-height:1.6;">Your feedback takes less than 10 seconds and helps us keep improving for every guest who walks through our door.</p>
          <p style="margin:0 0 32px;font-size:15px;color:#28251D;line-height:1.6;">We look forward to welcoming you back soon.</p>
          <p style="margin:0 0 4px;font-size:15px;color:#28251D;">Warmly,</p>
          <p style="margin:0;font-size:15px;font-weight:bold;color:#01696F;">The Luna Wellness Team</p>
        </td></tr>
        <tr><td style="padding:20px 40px;background:#F7F6F2;border-top:1px solid #D4D1CA;">
          <p style="margin:0;font-size:12px;color:#7A7974;">Luna Wellness Centre · Chilliwack, BC · <a href="https://www.lunawellnesscentre.ca" style="color:#01696F;">lunawellnesscentre.ca</a></p>
          <p style="margin:8px 0 0;font-size:11px;color:#BAB9B4;">You're receiving this because you recently visited Luna Wellness Centre.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Luna Wellness Centre" <${getFromEmail()}>`,
      to: params.email,
      subject: `How was your visit today, ${params.firstName}?`,
      html,
    });
    console.log(`[Email] Feedback email sent to ${params.email}`);
    return true;
  } catch (err: any) {
    console.error("[Email] Gmail error (feedback):", err.message);
    return false;
  }
}

export async function sendReviewRequestEmail(params: {
  clientId: number;
  firstName: string;
  email: string;
}): Promise<boolean> {
  const appPassword = storage.getSetting("gmail_app_password");
  if (!appPassword) return false;

  const reviewLink = getGoogleReviewLink();

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F6F2;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F2;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#01696F;padding:32px 40px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:1px;">LUNA WELLNESS CENTRE</p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Chilliwack, BC</p>
        </td></tr>
        <tr><td align="center" style="padding:24px;background:#FFF8E7;">
          <span style="font-size:32px;color:#F5A623;">★★★★★</span>
          <p style="margin:8px 0 0;font-size:13px;color:#7A7974;font-weight:bold;">5-STAR RATING RECEIVED</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:#28251D;">Hi ${params.firstName},</p>
          <p style="margin:0 0 16px;font-size:15px;color:#28251D;line-height:1.6;">Five stars — that genuinely means the world to us. Thank you for sharing how your session felt. It's exactly the kind of feedback that keeps our team inspired.</p>
          <p style="margin:0 0 28px;font-size:15px;color:#28251D;line-height:1.6;">Would you be willing to share your experience on Google? It takes about 60 seconds and helps other people in Chilliwack discover the kind of wellness experience you had today.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td align="center">
              <a href="${reviewLink}" style="display:inline-block;background:#01696F;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;padding:16px 40px;border-radius:8px;">★ Leave a Google Review ★</a>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td style="background:#E6F3F3;border:2px solid #01696F;border-radius:8px;padding:24px;text-align:center;">
              <p style="margin:0 0 6px;font-size:22px;font-weight:bold;color:#01696F;">$25 Luna Wellness Account Credit</p>
              <p style="margin:0;font-size:13px;color:#7A7974;">Applied automatically to your MINDBODY account within 60 minutes of your review going live. No code required.</p>
            </td></tr>
          </table>
          <p style="margin:0 0 16px;font-size:14px;color:#7A7974;font-style:italic;">Tip: Using your first and last name when leaving the review helps us match it to your account automatically.</p>
          <p style="margin:0 0 32px;font-size:15px;color:#28251D;line-height:1.6;">Thank you again, ${params.firstName}. We hope to see you very soon.</p>
          <p style="margin:0 0 4px;font-size:15px;color:#28251D;">With gratitude,</p>
          <p style="margin:0;font-size:15px;font-weight:bold;color:#01696F;">The Luna Wellness Team</p>
        </td></tr>
        <tr><td style="padding:20px 40px;background:#F7F6F2;border-top:1px solid #D4D1CA;">
          <p style="margin:0;font-size:12px;color:#7A7974;">Luna Wellness Centre · Chilliwack, BC · <a href="https://www.lunawellnesscentre.ca" style="color:#01696F;">lunawellnesscentre.ca</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Luna Wellness Centre" <${getFromEmail()}>`,
      to: params.email,
      subject: `You made our day, ${params.firstName} — a small thank-you inside`,
      html,
    });
    console.log(`[Email] Review request email sent to ${params.email}`);
    return true;
  } catch (err: any) {
    console.error("[Email] Gmail error (review request):", err.message);
    return false;
  }
}

export async function sendStaffCreditNotification(params: {
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  reviewText?: string;
}): Promise<boolean> {
  const appPassword = storage.getSetting("gmail_app_password");
  if (!appPassword) return false;

  const staffEmail = storage.getSetting("staff_email") || "info@lunafloat.ca";

  const html = `
<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;padding:32px;background:#F7F6F2;">
  <div style="max-width:500px;background:#fff;border-radius:8px;padding:32px;border:1px solid #D4D1CA;">
    <h2 style="color:#01696F;margin-top:0;">★ Google Review Detected — $25 Credit Applied</h2>
    <p><strong>Client:</strong> ${params.clientFirstName} ${params.clientLastName}</p>
    <p><strong>Email:</strong> ${params.clientEmail}</p>
    ${params.reviewText ? `<p><strong>Review:</strong> "${params.reviewText}"</p>` : ""}
    <p style="color:#7A7974;font-size:13px;">The $25 account credit has been automatically applied to their MINDBODY account.</p>
  </div>
</body></html>`;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Luna Wellness Automation" <${getFromEmail()}>`,
      to: staffEmail,
      subject: `★ ${params.clientFirstName} ${params.clientLastName} left a Google review — $25 credit applied`,
      html,
    });
    return true;
  } catch (err: any) {
    console.error("[Email] Gmail error (staff notification):", err.message);
    return false;
  }
}
