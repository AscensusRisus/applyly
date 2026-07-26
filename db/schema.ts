import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const applications = sqliteTable("applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  company: text("company").notNull(),
  role: text("role").notNull(),
  location: text("location").notNull().default("Remote"),
  status: text("status").notNull().default("Applied"),
  appliedDate: text("applied_date").notNull(),
  salary: text("salary"),
  url: text("url"),
  notes: text("notes"),
  contactEmail: text("contact_email"),
  source: text("source"),
  nextStep: text("next_step"),
  nextActionDate: text("next_action_date"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const applicationStatusHistory = sqliteTable("application_status_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: integer("application_id").notNull(),
  status: text("status").notNull(),
  changedAt: integer("changed_at", { mode: "timestamp_ms" }).notNull(),
  note: text("note"),
});

