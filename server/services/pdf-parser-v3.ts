import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

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
  batchSection: string; // e.g., "71_J"
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
  faculty: string[]; // Unique teacher initials
}

const DAYS = ["SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

// Course name mapping (official DIU CSE course names)
const COURSE_NAMES: Record<string, string> = {
  // Level 1
  ENG101: "Basic Functional English and English Spoken",
  ENG102: "Writing and Comprehension",
  MAT101: "Mathematics - I",
  MAT102: "Mathematics-II: Calculus, Complex Variables and Linear Algebra",
  CSE112: "Computer Fundamentals",
  CSE113: "Programming and Problem Solving",
  CSE114: "Programming and Problem Solving Lab",
  CSE115: "Introduction to Biology and Chemistry for Computation",
  CSE121: "Electrical Circuits",
  CSE122: "Electrical Circuits Lab",
  CSE123: "Data Structure",
  CSE124: "Data Structure Lab",
  PHY101: "Physics-I",
  PHY102: "Physics - II",
  PHY103: "Physics - II Lab",
  
  // Level 2
  MAT211: "Engineering Mathematics",
  CSE212: "Discrete Mathematics",
  CSE213: "Algorithms",
  CSE214: "Algorithms Lab",
  CSE215: "Electronic Devices and Circuits",
  CSE216: "Electronic Devices and Circuits Lab",
  CSE221: "Object Oriented Programming",
  CSE222: "Object Oriented Programming Lab",
  CSE223: "Digital Logic Design",
  CSE224: "Digital Logic Design Lab",
  CSE225: "Data Communication",
  CSE226: "Numerical Methods",
  CSE227: "Systems Analysis and Design",
  CSE228: "Theory of Computation",
  BNS101: "Bangladesh Studies (History of Independence and Contemporary Issues)",
  STA101: "Statistics and Probability",
  AOL101: "Art of Living",
  
  // Level 3
  CSE311: "Database Management System",
  CSE312: "Database Management System Lab",
  CSE313: "Compiler Design",
  CSE314: "Compiler Design Lab",
  CSE315: "Software Engineering",
  CSE316: "Artificial Intelligence",
  CSE317: "Microprocessor and Microcontrollers",
  CSE321: "Computer Networks",
  CSE322: "Computer Networks Lab",
  CSE323: "Operating Systems",
  CSE324: "Operating Systems Lab",
  CSE325: "Instrumentation and Control",
  CSE326: "Social and Professional Issues in Computing",
  ACT327: "Financial and Managerial Accounting",
  ECO426: "Engineering Economics",
  
  // Level 4
  CSE411: "Computer Graphics",
  CSE412: "Computer Graphics Lab",
  CSE413: "Computer Architecture and Organization",
  CSE498: "Capstone Project (Phase I)",
  CSE499: "Capstone Project (Phase II)",
};

export class PDFParserV3 {
  /**
   * Download and parse PDF from URL using pdftotext -layout
   */
  async parsePDFFromURL(url: string): Promise<ParsedSchedule> {
    let tempPdfPath: string | null = null;
    
    try {
      // Download PDF to temp file
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
      });

      const pdfBuffer = Buffer.from(response.data);
      
      // Create temp file
      tempPdfPath = path.join(os.tmpdir(), `routine_${Date.now()}.pdf`);
      await fs.writeFile(tempPdfPath, pdfBuffer);

      // Extract text with layout preserved
      const { stdout } = await execAsync(`pdftotext -layout "${tempPdfPath}" -`);
      const text = stdout;

      // Extract classes
      const classes = this.extractClasses(text);

      console.log(`Extracted ${classes.length} classes from PDF`);

      // Calculate stats
      const stats = this.calculateStats(classes);

      // Get unique faculty
      const faculty = Array.from(new Set(classes.map((c) => c.teacher)));

      return { classes, stats, faculty };
    } catch (error) {
      console.error("PDF parsing error:", error);
      throw new Error(`Failed to parse PDF: ${error}`);
    } finally {
      // Clean up temp file
      if (tempPdfPath) {
        try {
          await fs.unlink(tempPdfPath);
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Extract class schedules from PDF text with layout preserved
   * 
   * With -layout option, the PDF preserves column positions.
   * Time slots are in columns, and we can detect which column based on character position.
   */
  private extractClasses(text: string): ClassSchedule[] {
    const classes: ClassSchedule[] = [];
    const seen = new Set<string>(); // Track unique classes
    const lines = text.split("\n");

    let currentDay = "";
    let timeSlots: Array<{ start: string; end: string; columnStart: number; columnEnd: number }> = [];
    let inComLabSection = false; // Track if we're in COM LAB section to mark labs

    // Pattern to match: Course(Batch_Section) followed by Teacher
    // Example: CSE112(71_I) followed by MB
    const coursePattern = /([A-Z]{3}\d{3})\((\d{2,3})_([A-Z]\d?)\)/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this is a day header
      const dayUpper = line.trim().toUpperCase();
      if (DAYS.includes(dayUpper)) {
        currentDay = dayUpper;
        timeSlots = [];
        inComLabSection = false; // Reset COM LAB flag for new day
        
        // Extract time slots from next line (i+1)
        const timeLine = lines[i + 1] || "";
        const timePattern = /(\d{2}:\d{2})-(\d{2}:\d{2})/g;
        const times: Array<{ start: string; end: string }> = [];
        let timeMatch;
        
        while ((timeMatch = timePattern.exec(timeLine)) !== null) {
          times.push({ start: timeMatch[1], end: timeMatch[2] });
        }
        
        // Extract column positions from header line (i+2: Room/Course/Teacher)
        const headerLine = lines[i + 2] || "";
        const courseHeaderPattern = /Course/g;
        const columnPositions: number[] = [];
        let headerMatch;
        
        while ((headerMatch = courseHeaderPattern.exec(headerLine)) !== null) {
          columnPositions.push(headerMatch.index);
        }
        
        // Build time slots with column boundaries based on Course header positions
        if (times.length === columnPositions.length) {
          for (let j = 0; j < times.length; j++) {
            const currentPos = columnPositions[j];
            const nextPos = columnPositions[j + 1];
            
            // Column boundary is midpoint between current and next Course header
            const columnStart = j === 0 ? 0 : Math.floor((columnPositions[j - 1] + currentPos) / 2);
            const columnEnd = nextPos ? Math.floor((currentPos + nextPos) / 2) : 300;
            
            timeSlots.push({
              start: times[j].start,
              end: times[j].end,
              columnStart,
              columnEnd,
            });
          }
        }
        
        continue;
      }

      // Track COM LAB section (starts when we see first (COM LAB) marker)
      if (line.includes('(COM LAB)') || line.includes('COM LAB')) {
        inComLabSection = true;
        continue; // Skip the marker line itself
      }
      
      // Skip if no current day or no time slots
      if (!currentDay || timeSlots.length === 0) continue;

      // Find all course entries in this line
      let match;
      while ((match = coursePattern.exec(line)) !== null) {
        const courseCode = match[1];
        const batch = match[2];
        const section = match[3];
        const matchPosition = match.index;

        // Determine which time slot column this class is in
        let timeSlot = timeSlots[0]; // Default to first slot
        for (const slot of timeSlots) {
          if (matchPosition >= slot.columnStart && matchPosition < slot.columnEnd) {
            timeSlot = slot;
            break;
          }
        }

        // Extract room (look backwards from course position)
        const beforeCourse = line.substring(Math.max(0, matchPosition - 50), matchPosition);
        const roomPattern = /([A-Z]{1,2}-\d{2,3}(?:\([A-Z]\))?|G\d-\d{3})\s*$/;
        const roomMatch = roomPattern.exec(beforeCourse);
        const room = roomMatch ? roomMatch[1] : "TBA";

        // Extract teacher (look forwards from course position)
        const afterCourse = line.substring(match.index + match[0].length, match.index + match[0].length + 30);
        const teacherPattern = /^\s*([A-Z]{2,4}(?:_\d+)?)/;
        const teacherMatch = teacherPattern.exec(afterCourse);
        const teacher = teacherMatch ? teacherMatch[1] : "TBA";

        const courseName = COURSE_NAMES[courseCode] || courseCode;
        const batchSection = `${batch}_${section}`;

        const classEntry: ClassSchedule = {
          day: currentDay,
          timeStart: timeSlot.start,
          timeEnd: timeSlot.end,
          courseCode,
          courseName,
          batch,
          section,
          room: inComLabSection ? `${room} (LAB)` : room,
          teacher,
          batchSection,
        };

        // Create unique key to prevent duplicates
        const uniqueKey = `${currentDay}|${timeSlot.start}|${courseCode}|${batchSection}`;
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          classes.push(classEntry);
        }
      }
    }

    return classes;
  }

  /**
   * Calculate statistics for a set of classes
   */
  calculateStats(classes: ClassSchedule[]): ScheduleStats {
    // Count classes per day
    const dayCounts: Record<string, number> = {};
    DAYS.forEach((day) => {
      dayCounts[day] = classes.filter((c) => c.day === day).length;
    });

    // Find busiest and lightest days
    let busiestDay = DAYS[0];
    let busiestCount = 0;
    let lightestDay = DAYS[0];
    let lightestCount = Infinity;

    DAYS.forEach((day) => {
      const count = dayCounts[day];
      if (count > busiestCount) {
        busiestCount = count;
        busiestDay = day;
      }
      if (count < lightestCount && count > 0) {
        lightestCount = count;
        lightestDay = day;
      }
    });

    return {
      totalClasses: classes.length,
      busiestDay: busiestDay.charAt(0) + busiestDay.slice(1).toLowerCase(),
      lightestDay: lightestDay.charAt(0) + lightestDay.slice(1).toLowerCase(),
      busiestDayCount: busiestCount,
      lightestDayCount: lightestCount === Infinity ? 0 : lightestCount,
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
      // Convert SATURDAY -> Saturday for frontend compatibility
      const formattedDay = day.charAt(0) + day.slice(1).toLowerCase();
      grouped[formattedDay] = classes.filter((c) => c.day === day);
    });

    return grouped;
  }
}

// Export singleton instance
export const pdfParserV3 = new PDFParserV3();
