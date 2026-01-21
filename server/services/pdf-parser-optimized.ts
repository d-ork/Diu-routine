import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

const execAsync = promisify(exec);

export interface ClassSchedule {
  day: string;
  timeStart: string;
  timeEnd: string;
  courseCode: string;
  courseName: string;
  batch: string;
  section: string;
  room: string;
  teacher: string;
  batchSection: string;
}

export interface ScheduleStats {
  totalClasses: number;
  busiestDay: string;
  lightestDay: string;
  busiestDayCount: number;
  lightestDayCount: number;
}

export interface ParsedSchedule {
  classes: ClassSchedule[];
  stats: ScheduleStats;
  faculty: string[];
}

const DAYS = ["SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

// In-memory cache for recently parsed PDFs
const memoryCache = new Map<string, { data: ParsedSchedule; timestamp: number }>();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Course name mapping (abbreviated for speed)
const COURSE_NAMES: Record<string, string> = {
  CSE112: "Computer Fundamentals",
  CSE113: "Programming and Problem Solving",
  CSE114: "Programming and Problem Solving Lab",
  CSE123: "Data Structure",
  CSE124: "Data Structure Lab",
  CSE213: "Algorithms",
  CSE214: "Algorithms Lab",
  CSE221: "Object Oriented Programming",
  CSE222: "Object Oriented Programming Lab",
  CSE223: "Digital Logic Design",
  CSE224: "Digital Logic Design Lab",
  CSE225: "Data Communication",
  CSE311: "Database Management System",
  CSE312: "Database Management System Lab",
  CSE313: "Compiler Design",
  CSE314: "Compiler Design Lab",
  CSE315: "Software Engineering",
  CSE316: "Artificial Intelligence",
  CSE321: "Computer Networks",
  CSE322: "Computer Networks Lab",
  CSE323: "Operating Systems",
  CSE324: "Operating Systems Lab",
  CSE411: "Computer Graphics",
  CSE412: "Computer Graphics Lab",
  CSE413: "Computer Architecture and Organization",
  CSE498: "Capstone Project (Phase I)",
  CSE499: "Capstone Project (Phase II)",
  MAT101: "Mathematics - I",
  MAT102: "Mathematics-II",
  ENG101: "Basic Functional English",
  ENG102: "Writing and Comprehension",
  PHY101: "Physics-I",
  PHY102: "Physics - II",
};

export class PDFParserOptimized {
  /**
   * Download and parse PDF from URL with optimizations:
   * - Streaming download
   * - In-memory caching
   * - Parallel text extraction
   */
  async parsePDFFromURL(url: string): Promise<ParsedSchedule> {
    const startTime = Date.now();
    
    // Check memory cache first
    const cached = memoryCache.get(url);
    if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
      console.log(`[PDFParser] Using memory cache (${Date.now() - startTime}ms)`);
      return cached.data;
    }

    let tempPdfPath: string | null = null;
    
    try {
      // Generate temp file path
      tempPdfPath = path.join(os.tmpdir(), `routine_${Date.now()}.pdf`);
      
      // Stream download directly to file (faster than buffering)
      const response = await axios.get(url, {
        responseType: "stream",
        timeout: 10000,
      });
      
      const writer = createWriteStream(tempPdfPath);
      await pipeline(response.data, writer);
      
      console.log(`[PDFParser] Downloaded PDF (${Date.now() - startTime}ms)`);

      // Extract text with layout preserved
      const { stdout } = await execAsync(`pdftotext -layout "${tempPdfPath}" -`, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      
      console.log(`[PDFParser] Extracted text (${Date.now() - startTime}ms)`);

      // Extract classes (this is the main parsing logic)
      const classes = this.extractClasses(stdout);
      
      console.log(`[PDFParser] Parsed ${classes.length} classes (${Date.now() - startTime}ms)`);

      // Calculate stats quickly
      const stats = this.calculateStats(classes);
      const faculty = [...new Set(classes.map((c) => c.teacher))];

      const result = { classes, stats, faculty };
      
      // Store in memory cache
      memoryCache.set(url, { data: result, timestamp: Date.now() });
      
      // Clean up old cache entries (keep only last 5)
      if (memoryCache.size > 5) {
        const oldest = Array.from(memoryCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        memoryCache.delete(oldest[0]);
      }
      
      console.log(`[PDFParser] Total time: ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      console.error("[PDFParser] Error:", error);
      throw new Error(`Failed to parse PDF: ${error}`);
    } finally {
      // Clean up temp file (don't await to save time)
      if (tempPdfPath) {
        fs.unlink(tempPdfPath).catch(() => {});
      }
    }
  }

  /**
   * Extract class schedules from PDF text (optimized version)
   */
  private extractClasses(text: string): ClassSchedule[] {
    const classes: ClassSchedule[] = [];
    const seen = new Set<string>();
    const lines = text.split("\n");

    let currentDay = "";
    let timeSlots: Array<{ start: string; end: string; columnStart: number; columnEnd: number }> = [];

    const coursePattern = /([A-Z]{3}\d{3})\((\d{2,3})_([A-Z]\d?)\)/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const dayUpper = line.trim().toUpperCase();
      
      if (DAYS.includes(dayUpper)) {
        currentDay = dayUpper;
        timeSlots = [];
        
        // Extract time slots
        const timeLine = lines[i + 1] || "";
        const timePattern = /(\d{2}:\d{2})-(\d{2}:\d{2})/g;
        const times: Array<{ start: string; end: string }> = [];
        let timeMatch;
        
        while ((timeMatch = timePattern.exec(timeLine)) !== null) {
          times.push({ start: timeMatch[1], end: timeMatch[2] });
        }
        
        // Extract column positions
        const headerLine = lines[i + 2] || "";
        const courseHeaderPattern = /Course/g;
        const columnPositions: number[] = [];
        let headerMatch;
        
        while ((headerMatch = courseHeaderPattern.exec(headerLine)) !== null) {
          columnPositions.push(headerMatch.index);
        }
        
        // Map time slots to column positions
        timeSlots = times.map((time, idx) => ({
          start: time.start,
          end: time.end,
          columnStart: columnPositions[idx] || 0,
          columnEnd: columnPositions[idx + 1] || 999,
        }));
        
        i += 2; // Skip time and header lines
        continue;
      }

      if (!currentDay || timeSlots.length === 0) continue;

      // Extract courses from this line
      let match;
      coursePattern.lastIndex = 0;
      
      while ((match = coursePattern.exec(line)) !== null) {
        const courseCode = match[1];
        const batch = match[2];
        const section = match[3];
        const matchPosition = match.index;
        const batchSection = `${batch}_${section}`;
        
        // Debug: log all 71_I matches before filtering
        if (batchSection === "71_I") {
          console.log(`[FOUND] ${courseCode}(71_I) on line, day=${currentDay}, slots=${timeSlots.length}`);
        }
        
        // Find which time slot this course belongs to
        const slot = timeSlots.find(
          (s) => matchPosition >= s.columnStart && matchPosition < s.columnEnd
        );
        
        if (!slot) {
          if (batchSection === "71_I") {
            console.log(`[SKIP] ${courseCode}(71_I) - no time slot found`);
          }
          continue;
        }

        // Extract teacher initials (next 1-3 uppercase letters after the course)
        const afterCourse = line.substring(match.index + match[0].length);
        const teacherMatch = afterCourse.match(/^\s*([A-Z]{1,3})\b/);
        const teacher = teacherMatch ? teacherMatch[1] : "TBA";

        // Extract room (look for patterns like KT-222, AB1-101) in the column area
        const columnText = line.substring(slot.columnStart, slot.columnEnd);
        const roomMatch = columnText.match(/([A-Z]{2,3}\d?-?\d{3})/);
        const room = roomMatch ? roomMatch[1] : "TBA";
        const uniqueKey = `${currentDay}-${slot.start}-${courseCode}-${batchSection}-${teacher}-${room}`;
        
        // Debug logging for 71_I
        if (batchSection === "71_I") {
          console.log(`[71_I] ${courseCode} ${currentDay} ${slot.start} teacher=${teacher} room=${room} key=${uniqueKey}`);
        }
        
        // Only skip if EXACT duplicate (same day, time, course, section, teacher, AND room)
        if (seen.has(uniqueKey)) {
          if (batchSection === "71_I") {
            console.log(`[71_I] SKIPPED duplicate: ${uniqueKey}`);
          }
          continue;
        }
        seen.add(uniqueKey);

        classes.push({
          day: currentDay.charAt(0) + currentDay.slice(1).toLowerCase(),
          timeStart: slot.start,
          timeEnd: slot.end,
          courseCode,
          courseName: COURSE_NAMES[courseCode] || courseCode,
          batch,
          section,
          batchSection,
          room,
          teacher,
        });
      }
    }

    return classes;
  }

  /**
   * Calculate schedule statistics (optimized)
   */
  calculateStats(classes: ClassSchedule[]): ScheduleStats {
    const dayCount: Record<string, number> = {};
    
    for (const cls of classes) {
      dayCount[cls.day] = (dayCount[cls.day] || 0) + 1;
    }

    const entries = Object.entries(dayCount);
    if (entries.length === 0) {
      return {
        totalClasses: 0,
        busiestDay: "N/A",
        lightestDay: "N/A",
        busiestDayCount: 0,
        lightestDayCount: 0,
      };
    }

    const busiest = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
    const lightest = entries.reduce((a, b) => (a[1] < b[1] ? a : b));

    return {
      totalClasses: classes.length,
      busiestDay: busiest[0],
      busiestDayCount: busiest[1],
      lightestDay: lightest[0],
      lightestDayCount: lightest[1],
    };
  }

  /**
   * Filter classes by batch and section
   */
  filterByBatchSection(classes: ClassSchedule[], batchSection: string): ClassSchedule[] {
    return classes.filter((c) => c.batchSection === batchSection);
  }

  /**
   * Filter classes by teacher
   */
  filterByTeacher(classes: ClassSchedule[], teacher: string): ClassSchedule[] {
    return classes.filter((c) => c.teacher.toUpperCase() === teacher.toUpperCase());
  }

  /**
   * Filter classes by room
   */
  filterByRoom(classes: ClassSchedule[], room: string): ClassSchedule[] {
    return classes.filter((c) => c.room.includes(room.toUpperCase()));
  }

  /**
   * Group classes by day
   */
  groupByDay(classes: ClassSchedule[]): Record<string, ClassSchedule[]> {
    const grouped: Record<string, ClassSchedule[]> = {};

    DAYS.forEach((day) => {
      const formattedDay = day.charAt(0) + day.slice(1).toLowerCase();
      grouped[formattedDay] = classes.filter((c) => c.day.toUpperCase() === day);
    });

    return grouped;
  }
}

export const pdfParserOptimized = new PDFParserOptimized();
