import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Faculty table for storing scraped faculty data
 */
export const faculty = mysqlTable("faculty", {
  id: int("id").autoincrement().primaryKey(),
  fullName: text("fullName").notNull(),
  initials: varchar("initials", { length: 10 }).notNull().unique(),
  department: varchar("department", { length: 50 }).notNull().default("cse"),
  photoUrl: text("photoUrl"),
  profileUrl: text("profileUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Faculty = typeof faculty.$inferSelect;
export type InsertFaculty = typeof faculty.$inferInsert;

/**
 * PDF cache table for storing parsed routine PDFs
 */
export const pdfCache = mysqlTable("pdfCache", {
  id: int("id").autoincrement().primaryKey(),
  department: varchar("department", { length: 50 }).notNull(),
  pdfUrl: text("pdfUrl").notNull(),
  version: varchar("version", { length: 20 }).notNull().default("1.0"),
  parsedAt: timestamp("parsedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  totalClasses: int("totalClasses").notNull().default(0),
});

export type PdfCache = typeof pdfCache.$inferSelect;
export type InsertPdfCache = typeof pdfCache.$inferInsert;

/**
 * Class schedule table for storing individual class entries
 */
export const classSchedules = mysqlTable("classSchedules", {
  id: int("id").autoincrement().primaryKey(),
  cacheId: int("cacheId").notNull(), // Foreign key to pdfCache
  day: varchar("day", { length: 20 }).notNull(),
  timeStart: varchar("timeStart", { length: 10 }).notNull(),
  timeEnd: varchar("timeEnd", { length: 10 }).notNull(),
  courseCode: varchar("courseCode", { length: 20 }).notNull(),
  courseName: text("courseName"),
  batch: varchar("batch", { length: 10 }).notNull(),
  section: varchar("section", { length: 10 }).notNull(),
  batchSection: varchar("batchSection", { length: 20 }).notNull(), // e.g., "71_I"
  room: varchar("room", { length: 50 }).notNull(),
  teacher: varchar("teacher", { length: 20 }).notNull(),
  department: varchar("department", { length: 50 }).notNull().default("cse"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ClassSchedule = typeof classSchedules.$inferSelect;
export type InsertClassSchedule = typeof classSchedules.$inferInsert;
