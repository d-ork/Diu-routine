import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Faculty table for storing scraped faculty data
 */
export const faculty = pgTable("faculty", {
  id: varchar("id", { length: 255 }).primaryKey(), // initials as ID (e.g., "MB", "AST")
  fullName: text("full_name").notNull(),
  initials: varchar("initials", { length: 10 }).notNull().unique(),
  department: varchar("department", { length: 50 }).notNull().default("cse"),
  photoUrl: text("photo_url"),
  profileUrl: text("profile_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Faculty = typeof faculty.$inferSelect;
export type NewFaculty = typeof faculty.$inferInsert;
