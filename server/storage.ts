import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and, isNull, isNotNull } from "drizzle-orm";
import * as schema from "@shared/schema";
import { clients, automationLogs, settings } from "@shared/schema";
import type { Client, InsertClient, AutomationLog, InsertLog, Setting, InsertSetting } from "@shared/schema";
import { mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";

// Ensure the DB directory exists before opening (critical for Render /tmp paths)
const dbPath = resolve(process.env.DB_PATH || "data.db");
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}
console.log(`[DB] Opening database at: ${dbPath}`);
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

// Run migrations
db.run(`CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mindbody_client_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  service_name TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  feedback_email_sent_at TEXT,
  rating INTEGER,
  rated_at TEXT,
  review_request_email_sent_at TEXT,
  credit_pending INTEGER DEFAULT 0,
  credit_applied INTEGER DEFAULT 0,
  credit_applied_at TEXT,
  review_detected_at TEXT,
  review_text TEXT,
  credit_confirmation_email_sent_at TEXT,
  created_at TEXT NOT NULL,
  staff_notified_at TEXT
)`);

// Add new column if upgrading existing DB (safe no-op if already exists)
try { db.run(`ALTER TABLE clients ADD COLUMN credit_confirmation_email_sent_at TEXT`); } catch (_) {}

db.run(`CREATE TABLE IF NOT EXISTS automation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER,
  mindbody_client_id TEXT,
  event TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`);

export interface IStorage {
  // Clients
  createClient(data: InsertClient): Client;
  getClientByMindbodyId(mindbodyClientId: string): Client | undefined;
  getClientById(id: number): Client | undefined;
  getAllClients(): Client[];
  getClientsWithPendingCredit(): Client[];
  getClientsAwaitingFeedback(): Client[];
  updateClient(id: number, data: Partial<Client>): Client | undefined;

  // Logs
  addLog(data: InsertLog): AutomationLog;
  getLogs(limit?: number): AutomationLog[];
  getClientLogs(clientId: number): AutomationLog[];

  // Settings
  getSetting(key: string): string | undefined;
  setSetting(key: string, value: string): void;
  getAllSettings(): Setting[];

  // Stats
  getStats(): {
    totalFirstVisits: number;
    emailsSent: number;
    ratingsReceived: number;
    fiveStarRatings: number;
    reviewsDetected: number;
    creditsApplied: number;
  };
}

export class SqliteStorage implements IStorage {
  createClient(data: InsertClient): Client {
    return db.insert(clients).values(data).returning().get()!;
  }

  getClientByMindbodyId(mindbodyClientId: string): Client | undefined {
    return db.select().from(clients).where(eq(clients.mindbodyClientId, mindbodyClientId)).get();
  }

  getClientById(id: number): Client | undefined {
    return db.select().from(clients).where(eq(clients.id, id)).get();
  }

  getAllClients(): Client[] {
    return db.select().from(clients).orderBy(desc(clients.createdAt)).all();
  }

  getClientsWithPendingCredit(): Client[] {
    return db.select().from(clients)
      .where(and(eq(clients.creditPending, true), eq(clients.creditApplied, false)))
      .all();
  }

  getClientsAwaitingFeedback(): Client[] {
    return db.select().from(clients)
      .where(isNull(clients.feedbackEmailSentAt))
      .all();
  }

  updateClient(id: number, data: Partial<Client>): Client | undefined {
    return db.update(clients).set(data).where(eq(clients.id, id)).returning().get();
  }

  addLog(data: InsertLog): AutomationLog {
    return db.insert(automationLogs).values(data).returning().get()!;
  }

  getLogs(limit = 100): AutomationLog[] {
    return db.select().from(automationLogs).orderBy(desc(automationLogs.createdAt)).limit(limit).all();
  }

  getClientLogs(clientId: number): AutomationLog[] {
    return db.select().from(automationLogs)
      .where(eq(automationLogs.clientId, clientId))
      .orderBy(desc(automationLogs.createdAt))
      .all();
  }

  getSetting(key: string): string | undefined {
    return db.select().from(settings).where(eq(settings.key, key)).get()?.value;
  }

  setSetting(key: string, value: string): void {
    const existing = db.select().from(settings).where(eq(settings.key, key)).get();
    if (existing) {
      db.update(settings).set({ value, updatedAt: new Date().toISOString() }).where(eq(settings.key, key)).run();
    } else {
      db.insert(settings).values({ key, value, updatedAt: new Date().toISOString() }).run();
    }
  }

  getAllSettings(): Setting[] {
    return db.select().from(settings).all();
  }

  getStats() {
    const all = db.select().from(clients).all();
    return {
      totalFirstVisits: all.length,
      emailsSent: all.filter(c => c.feedbackEmailSentAt).length,
      ratingsReceived: all.filter(c => c.rating !== null).length,
      fiveStarRatings: all.filter(c => c.rating === 5).length,
      reviewsDetected: all.filter(c => c.reviewDetectedAt).length,
      creditsApplied: all.filter(c => c.creditApplied).length,
    };
  }
}

export const storage = new SqliteStorage();
