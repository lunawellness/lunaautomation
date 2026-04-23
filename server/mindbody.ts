import axios from "axios";
import { storage } from "./storage";

const MB_BASE = "https://api.mindbodyonline.com/public/v6";

function getMBConfig() {
  return {
    apiKey:         storage.getSetting("mindbody_api_key")         || process.env.MINDBODY_API_KEY         || "",
    siteId:         storage.getSetting("mindbody_site_id")         || process.env.MINDBODY_SITE_ID         || "",
    sourceName:     storage.getSetting("mindbody_source_name")     || process.env.MINDBODY_SOURCE_NAME     || "",
    sourcePassword: storage.getSetting("mindbody_source_password") || process.env.MINDBODY_SOURCE_PASSWORD || "",
  };
}

/**
 * Get a staff user token using source credentials.
 * For the sandbox: siteId=-99, sourceName=lunawellnesscenter
 * Staff username/password for sandbox: mindbodysandboxsite@gmail.com / Apitest1234
 */
async function getStaffToken(): Promise<string | null> {
  const { apiKey, siteId, sourceName, sourcePassword } = getMBConfig();
  if (!siteId || !sourceName || !sourcePassword) {
    console.warn("[MINDBODY] Missing credentials — skipping token fetch");
    return null;
  }

  // For sandbox we use the known sandbox staff credentials
  // For production these will come from settings
  const username = storage.getSetting("mindbody_staff_username") || "mindbodysandboxsite@gmail.com";
  const password = storage.getSetting("mindbody_staff_password") || "Apitest1234";

  try {
    const res = await axios.post(
      `${MB_BASE}/usertoken/issue`,
      {
        Username: username,
        Password: password,
      },
      {
        headers: {
          "API-Key":    apiKey || "temp_key", // sandbox doesn't enforce API key
          "SiteId":     siteId,
          "SourceName": sourceName,
          "Authorization": `Basic ${Buffer.from(`${sourceName}:${sourcePassword}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.data?.AccessToken || null;
  } catch (err: any) {
    console.error("[MINDBODY] Auth error:", JSON.stringify(err?.response?.data || err.message));
    return null;
  }
}

/**
 * Issue a source token (alternative to user token — works with just source credentials).
 * Used for operations that don't require staff impersonation.
 */
async function getSourceToken(): Promise<string | null> {
  const { siteId, sourceName, sourcePassword } = getMBConfig();
  if (!siteId || !sourceName || !sourcePassword) return null;

  try {
    const res = await axios.post(
      `${MB_BASE}/usertoken/issue`,
      {
        Username: sourceName,
        Password: sourcePassword,
        type: "Source",
      },
      {
        headers: {
          "SiteId": siteId,
          "Content-Type": "application/json",
        },
      }
    );
    return res.data?.AccessToken || null;
  } catch (err: any) {
    // Fall back — sandbox may use different token format
    console.error("[MINDBODY] Source token error:", JSON.stringify(err?.response?.data || err.message));
    return null;
  }
}

function getHeaders(token: string | null) {
  const { apiKey, siteId, sourceName, sourcePassword } = getMBConfig();
  return {
    "API-Key":       apiKey || "temp_key",
    "SiteId":        siteId,
    "SourceName":    sourceName,
    "Authorization": token
      ? token
      : `Basic ${Buffer.from(`${sourceName}:${sourcePassword}`).toString("base64")}`,
    "Content-Type":  "application/json",
  };
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const { apiKey, siteId, sourceName, sourcePassword } = getMBConfig();
  if (!siteId || !sourceName || !sourcePassword) {
    return { ok: false, message: "MINDBODY credentials not fully configured. Add Site ID, Source Name, and Source Password." };
  }
  if (!apiKey) {
    return {
      ok: false,
      message: "API Key missing. Go to developers.mindbodyonline.com → Account → API Credentials → Create new API Key, then paste it in Settings."
    };
  }

  try {
    const res = await axios.get(`${MB_BASE}/site/sites`, {
      params: { SiteIds: siteId },
      headers: getHeaders(null),
    });
    const site = res.data?.Sites?.[0];
    if (site) {
      return { ok: true, message: `Connected to: ${site.Name || "MINDBODY site " + siteId}` };
    }
    return { ok: true, message: "Connected to MINDBODY (sandbox)" };
  } catch (err: any) {
    const errMsg = err?.response?.data?.Error?.Message || err.message;
    return { ok: false, message: errMsg };
  }
}

export async function getClientByMindbodyId(mindbodyClientId: string): Promise<any | null> {
  const { siteId } = getMBConfig();
  if (!siteId) return null;

  const token = await getStaffToken();

  try {
    const res = await axios.get(`${MB_BASE}/client/clients`, {
      params: { clientIds: mindbodyClientId },
      headers: getHeaders(token),
    });
    return res.data?.Clients?.[0] || null;
  } catch (err: any) {
    console.error("[MINDBODY] getClient error:", JSON.stringify(err?.response?.data || err.message));
    return null;
  }
}

export async function isFirstVisit(mindbodyClientId: string): Promise<boolean> {
  const client = await getClientByMindbodyId(mindbodyClientId);
  if (!client) return false;

  const firstDate = client.FirstAppointmentDate;
  if (!firstDate) return false;

  // First visit if FirstAppointmentDate is within last 48h (handles timezone edge cases)
  const firstVisitDate = new Date(firstDate);
  const now = new Date();
  const diffHours = (now.getTime() - firstVisitDate.getTime()) / (1000 * 60 * 60);
  return diffHours <= 48;
}

export async function applyAccountCredit(params: {
  mindbodyClientId: string;
  amount: number;
  note?: string;
}): Promise<boolean> {
  const { siteId } = getMBConfig();
  if (!siteId) {
    console.warn("[MINDBODY] Not configured — credit not applied");
    return false;
  }

  const token = await getStaffToken();

  try {
    await axios.post(
      `${MB_BASE}/sale/purchaseaccountcredit`,
      {
        ClientId: params.mindbodyClientId,
        Amount: params.amount,
        Note: params.note || "Google review reward — Luna Wellness $25 credit",
      },
      { headers: getHeaders(token) }
    );
    return true;
  } catch (err: any) {
    console.error("[MINDBODY] applyCredit error:", JSON.stringify(err?.response?.data || err.message));
    return false;
  }
}
