import axios from "axios";
import { storage } from "./storage";
import type { Client } from "@shared/schema";

// Luna Wellness Centre Place ID decoded from Google Search URL
// CID: 9214584642039224058
const LUNA_PLACE_ID = "ChIJLVyDSChHhFQR-paENenH4H8";
const LUNA_CID = "9214584642039224058";

function getPlacesApiKey(): string {
  return storage.getSetting("google_places_api_key") || process.env.GOOGLE_PLACES_API_KEY || "";
}

/**
 * Fetch reviews via Google Places API (Details endpoint).
 * Requires a Google Cloud project with Places API enabled + unrestricted API key.
 * Free tier: 17,500 requests/month.
 */
export async function getRecentReviews(): Promise<any[]> {
  const apiKey = getPlacesApiKey();

  if (!apiKey) {
    // Fallback: try GBP API approach if tokens are configured
    return getReviewsViaGBP();
  }

  try {
    const res = await axios.get("https://maps.googleapis.com/maps/api/place/details/json", {
      params: {
        place_id: LUNA_PLACE_ID,
        fields: "reviews",
        reviews_sort: "newest",
        key: apiKey,
      },
    });

    if (res.data.status !== "OK") {
      console.error("[GBP] Places API error:", res.data.status, res.data.error_message);
      return [];
    }

    const reviews = res.data.result?.reviews || [];
    // Normalize to same format as GBP API
    return reviews.map((r: any) => ({
      starRating: starNumberToWord(r.rating),
      ratingNumber: r.rating,
      reviewer: { displayName: r.author_name },
      comment: r.text,
      createTime: new Date(r.time * 1000).toISOString(),
      updateTime: new Date(r.time * 1000).toISOString(),
    }));
  } catch (err: any) {
    console.error("[GBP] Places API fetch error:", err?.response?.data || err.message);
    return [];
  }
}

function starNumberToWord(n: number): string {
  const map: Record<number, string> = { 1: "ONE", 2: "TWO", 3: "THREE", 4: "FOUR", 5: "FIVE" };
  return map[n] || "FIVE";
}

/**
 * Fallback: GBP Management API (requires OAuth access token + account/location IDs).
 * Used if google_places_api_key is not set but GBP OAuth tokens are configured.
 */
async function getReviewsViaGBP(): Promise<any[]> {
  const accessToken = storage.getSetting("gbp_access_token") || process.env.GBP_ACCESS_TOKEN || "";
  const accountId = storage.getSetting("gbp_account_id") || process.env.GBP_ACCOUNT_ID || "";
  const locationId = storage.getSetting("gbp_location_id") || process.env.GBP_LOCATION_ID || "";

  if (!accessToken || !accountId || !locationId) {
    console.log("[GBP] No API credentials configured — review polling inactive.");
    return [];
  }

  try {
    const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`;
    const res = await axios.get(url, {
      params: { pageSize: 50 },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data?.reviews || [];
  } catch (err: any) {
    console.error("[GBP] GBP API error:", err?.response?.data || err.message);
    // Try token refresh
    await refreshAccessToken();
    return [];
  }
}

export function matchReviewToClient(reviewerName: string, clients: Client[]): Client | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const reviewNorm = normalize(reviewerName);

  for (const client of clients) {
    const fullName = normalize(`${client.firstName}${client.lastName}`);
    const firstName = normalize(client.firstName);
    const lastName = normalize(client.lastName);

    if (
      reviewNorm === fullName ||
      (reviewNorm.includes(firstName) && reviewNorm.includes(lastName)) ||
      // Also match first name only if it's distinctive (>4 chars)
      (firstName.length > 4 && reviewNorm === firstName)
    ) {
      return client;
    }
  }
  return null;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = storage.getSetting("gbp_refresh_token");
  const clientId = storage.getSetting("gbp_oauth_client_id");
  const clientSecret = storage.getSetting("gbp_oauth_client_secret");

  if (!refreshToken || !clientId || !clientSecret) return null;

  try {
    const res = await axios.post("https://oauth2.googleapis.com/token", {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const newToken = res.data.access_token;
    storage.setSetting("gbp_access_token", newToken);
    return newToken;
  } catch (err: any) {
    console.error("[GBP] Token refresh error:", err?.response?.data || err.message);
    return null;
  }
}

export { LUNA_PLACE_ID, LUNA_CID };
