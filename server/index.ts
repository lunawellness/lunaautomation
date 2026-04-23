import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "node:http";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { storage } from "./storage";
import { startPoller } from "./poller";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Seed default settings
function seedDefaults() {
  const defaults: Record<string, string> = {
    from_email: "info@lunafloat.ca",
    staff_email: "info@lunafloat.ca",
    google_review_link: "https://g.page/r/CfqWhDXpx-B_EBM/review",
    base_url: process.env.BASE_URL || "http://localhost:5000",
  };
  for (const [key, value] of Object.entries(defaults)) {
    if (!storage.getSetting(key)) {
      storage.setSetting(key, value);
    }
  }
  // Also apply env-provided keys if present
  if (process.env.SENDGRID_API_KEY) storage.setSetting("sendgrid_api_key", process.env.SENDGRID_API_KEY);
  if (process.env.GBP_ACCESS_TOKEN) storage.setSetting("gbp_access_token", process.env.GBP_ACCESS_TOKEN);
  if (process.env.MINDBODY_API_KEY) storage.setSetting("mindbody_api_key", process.env.MINDBODY_API_KEY);
  if (process.env.MINDBODY_SITE_ID) storage.setSetting("mindbody_site_id", process.env.MINDBODY_SITE_ID);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 100) logLine = logLine.slice(0, 99) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  seedDefaults();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (!res.headersSent) res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`Luna Wellness Automation running on port ${port}`);
    startPoller();
  });
})();
