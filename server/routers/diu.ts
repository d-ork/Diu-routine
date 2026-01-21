import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { FacultyScraper } from "../services/faculty-scraper";
import { FacultyService } from "../services/faculty-service";
import { pdfParserV3 } from "../services/pdf-parser-v3";
import { getLatestRoutinePdfUrl } from "../services/noticeboard-scraper";
import { PdfCacheService } from "../services/pdf-cache-service";

// Default PDF URLs by department
const DEFAULT_PDF_URLS: Record<string, string> = {
  cse: "https://daffodilvarsity.edu.bd/noticeFile/cse-class-routine-spring-2026-v1-8d732090c2.pdf",
  eee: "https://daffodilvarsity.edu.bd/noticeFile/eee-class-routine-spring-2026-v1.pdf",
  swe: "https://daffodilvarsity.edu.bd/noticeFile/swe-class-routine-spring-2026-v1.pdf",
};

export const diuRouter = router({
  /**
   * Scrape faculty data from DIU website
   */
  scrapeFaculty: publicProcedure
    .input(
      z.object({
        department: z.string().default("cse"),
      })
    )
    .query(async ({ input }) => {
      // Use FacultyService to get cached or fresh faculty data
      const faculty = await FacultyService.scrapeAndStoreFaculty(input.department, false);
      return { faculty };
    }),

  /**
   * Parse PDF and get all classes
   */
  parsePDF: publicProcedure
    .input(
      z.object({
        pdfUrl: z.string().url().optional(),
      })
    )
    .query(async ({ input }) => {
      const url = input.pdfUrl || DEFAULT_PDF_URLS.cse;
      const result = await pdfParserV3.parsePDFFromURL(url);
      return result;
    }),

  /**
   * Get student schedule by batch and section
   */
  getStudentSchedule: publicProcedure
    .input(
      z.object({
        batchSection: z.string(), // e.g., "71_I"
        department: z.string().default("cse"),
        pdfUrl: z.string().url().optional(),
      })
    )
    .query(async ({ input }) => {
      const url = input.pdfUrl || DEFAULT_PDF_URLS[input.department] || DEFAULT_PDF_URLS.cse;
      
      // Use cached data or parse PDF
      const allClasses = await PdfCacheService.getOrParsePdf(input.department, url);

      // Filter classes for this batch_section
      const classes = pdfParserV3.filterByBatchSection(allClasses, input.batchSection);

      // Get faculty for these classes
      const teacherInitials = Array.from(new Set(classes.map((c) => c.teacher)));

      // Scrape faculty data
      const facultyData = await FacultyScraper.scrapeFaculty("cse");

      // Match teachers to faculty
      const faculty = facultyData.filter((f: any) =>
        teacherInitials.some((initial) => f.initials === initial)
      );

      // Calculate stats for this student
      const stats = pdfParserV3.calculateStats(classes);

      // Group by day
      const schedule = pdfParserV3.groupByDay(classes);

      // Get cache info for timestamp
      const cacheStatus = await PdfCacheService.getCacheStatus(input.department);

      return {
        batchSection: input.batchSection,
        classes,
        schedule,
        stats,
        faculty,
        parsedAt: cacheStatus.parsedAt,
      };
    }),

  /**
   * Get teacher schedule by initials
   */
  getTeacherSchedule: publicProcedure
    .input(
      z.object({
        teacherInitials: z.string(), // e.g., "MB"
        department: z.string().default("cse"),
        pdfUrl: z.string().url().optional(),
      })
    )
    .query(async ({ input }) => {
      const url = input.pdfUrl || DEFAULT_PDF_URLS[input.department] || DEFAULT_PDF_URLS.cse;
      
      // Use cached data or parse PDF
      const allClasses = await PdfCacheService.getOrParsePdf(input.department, url);

      // Filter classes for this teacher
      const classes = pdfParserV3.filterByTeacher(allClasses, input.teacherInitials);

      // Get unique sections taught
      const sections = Array.from(new Set(classes.map((c) => c.batchSection))).join(", ");

      // Calculate stats
      const stats = pdfParserV3.calculateStats(classes);

      // Group by day
      const schedule = pdfParserV3.groupByDay(classes);

      return {
        teacherInitials: input.teacherInitials.toUpperCase(),
        sections,
        classes,
        schedule,
        stats,
      };
    }),

  /**
   * Get room schedule by room number
   */
  getRoomSchedule: publicProcedure
    .input(
      z.object({
        roomNumber: z.string(), // e.g., "KT-222"
        department: z.string().default("cse"),
        pdfUrl: z.string().url().optional(),
      })
    )
    .query(async ({ input }) => {
      const url = input.pdfUrl || DEFAULT_PDF_URLS[input.department] || DEFAULT_PDF_URLS.cse;
      
      // Use cached data or parse PDF
      const allClasses = await PdfCacheService.getOrParsePdf(input.department, url);

      // Filter classes for this room
      const classes = pdfParserV3.filterByRoom(allClasses, input.roomNumber);

      // Calculate stats
      const stats = pdfParserV3.calculateStats(classes);

      // Group by day
      const schedule = pdfParserV3.groupByDay(classes);

      return {
        roomNumber: input.roomNumber.toUpperCase(),
        classes,
        schedule,
        stats,
      };
    }),

  /**
   * Get latest PDF URL for a department from noticeboard
   */
  getLatestPdfUrl: publicProcedure
    .input(
      z.object({
        department: z.string().default("cse"),
      })
    )
    .query(async ({ input }) => {
      const pdfUrl = await getLatestRoutinePdfUrl(input.department);
      return {
        department: input.department,
        pdfUrl: pdfUrl || DEFAULT_PDF_URLS[input.department] || DEFAULT_PDF_URLS.cse,
        isLatest: !!pdfUrl,
      };
    }),

  /**
   * Clear cache for a department and force re-parse
   */
  clearCache: publicProcedure
    .input(
      z.object({
        department: z.string().default("cse"),
      })
    )
    .mutation(async ({ input }) => {
      await PdfCacheService.clearCache(input.department);
      return {
        success: true,
        message: `Cache cleared for ${input.department}`,
      };
    }),

  /**
   * Get all unique batch_sections from cached data
   */
  getAllBatchSections: publicProcedure
    .input(
      z.object({
        department: z.string().default("cse"),
        pdfUrl: z.string().url().optional(),
      })
    )
    .query(async ({ input }) => {
      const url = input.pdfUrl || DEFAULT_PDF_URLS[input.department] || DEFAULT_PDF_URLS.cse;
      
      // Use cached data or parse PDF
      const allClasses = await PdfCacheService.getOrParsePdf(input.department, url);
      
      // Extract unique batch_sections
      const batchSections = Array.from(new Set(allClasses.map((c) => c.batchSection))).sort();
      
      return {
        batchSections,
        total: batchSections.length,
      };
    }),

  /**
   * Get all faculty members
   */
  getAllFaculty: publicProcedure
    .input(
      z.object({
        department: z.string().default("cse"),
      })
    )
    .query(async ({ input }) => {
      const faculty = await FacultyService.scrapeAndStoreFaculty(input.department, false);
      return { faculty };
    }),
});
