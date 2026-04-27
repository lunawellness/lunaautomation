import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tracks every first-visit client entering the automation
export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mindbodyClientId: text("mindbody_client_id").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  serviceName: text("service_name").notNull(),
  visitDate: text("visit_date").notNull(), // ISO string
  // Automation state
  feedbackEmailSentAt: text("feedback_email_sent_at"),
  rating: integer("rating"), // 1-5, null until they click
  ratedAt: text("rated_at"),
  reviewRequestEmailSentAt: text("review_request_email_sent_at"),
  // Credit state
  creditPending: integer("credit_pending", { mode: "boolean" }).default(false),
  creditApplied: integer("credit_applied", { mode: "boolean" }).default(false),
  creditAppliedAt: text("credit_applied_at"),
  reviewDetectedAt: text("review_detected_at"),
  reviewText: text("review_text"),
  creditConfirmationEmailSentAt: text("credit_confirmation_email_sent_at"),
  // Meta
  createdAt: text("created_at").notNull(),
  staffNotifiedAt: text("staff_notified_at"),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Log of all automation events for audit trail
export const automationLogs = sqliteTable("automation_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id"),
  mindbodyClientId: text("mindbody_client_id"),
  event: text("event").notNull(), // 'webhook_received', 'email_sent', 'rating_received', 'review_detected', 'credit_applied', etc.
  details: text("details"), // JSON string
  createdAt: text("created_at").notNull(),
});

export const insertLogSchema = createInsertSchema(automationLogs).omit({ id: true });
export type InsertLog = z.infer<typeof insertLogSchema>;
export type AutomationLog = typeof automationLogs.$inferSelect;

// Settings store for API keys and config (encrypted at rest conceptually)
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true });
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;
