import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { pdfCache, classSchedules } from "../../drizzle/schema";
import { pdfParserV3, type ClassSchedule } from "./pdf-parser-v3";

const CACHE_DURATION_DAYS = 30; // Cache expires after 30 days

export class PdfCacheService {
  /**
   * Get cached PDF data or parse and cache if not found/expired
   */
  static async getOrParsePdf(department: string, pdfUrl: string, version: string = "1.0"): Promise<ClassSchedule[]> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check if we have valid cache
    const cache = await db
      .select()
      .from(pdfCache)
      .where(
        and(
          eq(pdfCache.department, department),
          eq(pdfCache.version, version)
        )
      )
      .limit(1);

    const now = new Date();
    const validCache = cache.find((c) => new Date(c.expiresAt) > now);

    if (validCache) {
      console.log(`Using cached PDF data for ${department} v${version}`);
      
      // Get classes from cache
      const classes = await db
        .select()
        .from(classSchedules)
        .where(eq(classSchedules.cacheId, validCache.id));

      return classes.map((c) => ({
        day: c.day,
        timeStart: c.timeStart,
        timeEnd: c.timeEnd,
        courseCode: c.courseCode,
        courseName: c.courseName || c.courseCode,
        batch: c.batch,
        section: c.section,
        batchSection: c.batchSection,
        room: c.room,
        teacher: c.teacher,
      }));
    }

    // No valid cache, parse PDF
    console.log(`Parsing PDF for ${department} v${version}...`);
    const parsed = await pdfParserV3.parsePDFFromURL(pdfUrl);

    // Store in cache
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_DURATION_DAYS);

    const [newCache] = await db.insert(pdfCache).values({
      department,
      pdfUrl,
      version,
      expiresAt,
      totalClasses: parsed.classes.length,
    });

    const cacheId = (newCache as any).insertId;

    // Store classes
    if (parsed.classes.length > 0) {
      await db.insert(classSchedules).values(
        parsed.classes.map((c) => ({
          cacheId,
          day: c.day,
          timeStart: c.timeStart,
          timeEnd: c.timeEnd,
          courseCode: c.courseCode,
          courseName: c.courseName,
          batch: c.batch,
          section: c.section,
          batchSection: c.batchSection,
          room: c.room,
          teacher: c.teacher,
          department,
        }))
      );
    }

    console.log(`Cached ${parsed.classes.length} classes for ${department}`);
    return parsed.classes;
  }

  /**
   * Clear cache for a department
   */
  static async clearCache(department: string): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get cache IDs
    const caches = await db
      .select()
      .from(pdfCache)
      .where(eq(pdfCache.department, department));

    // Delete classes
    for (const cache of caches) {
      await db.delete(classSchedules).where(eq(classSchedules.cacheId, cache.id));
    }

    // Delete cache entries
    await db.delete(pdfCache).where(eq(pdfCache.department, department));

    console.log(`Cleared cache for ${department}`);
  }

  /**
   * Get cache status
   */
  static async getCacheStatus(department: string): Promise<{
    isCached: boolean;
    parsedAt?: Date;
    expiresAt?: Date;
    totalClasses?: number;
  }> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const cache = await db
      .select()
      .from(pdfCache)
      .where(eq(pdfCache.department, department))
      .limit(1);

    if (cache.length === 0) {
      return { isCached: false };
    }

    const c = cache[0];
    const now = new Date();
    const isExpired = new Date(c.expiresAt) <= now;

    return {
      isCached: !isExpired,
      parsedAt: c.parsedAt,
      expiresAt: c.expiresAt,
      totalClasses: c.totalClasses,
    };
  }
}
