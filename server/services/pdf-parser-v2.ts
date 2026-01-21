import axios from "axios";
import pdfParse from "pdf-parse";

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

// Course name mapping (common CSE courses)
const COURSE_NAMES: Record<string, string> = {
  CSE112: "Computer Fundamentals",
  CSE113: "Programming Language I",
  CSE114: "Programming Language I Lab",
  CSE115: "Programming Language II",
  CSE116: "Programming Language II Lab",
  CSE122: "Digital Logic Design",
  CSE211: "Data Structures",
  CSE213: "Object Oriented Programming",
  CSE224: "Digital Electronics",
  CSE311: "Database Management System",
  CSE312: "Database Management System Lab",
  CSE313: "Computer Architecture",
  CSE315: "Computer Networks",
  CSE316: "Computer Networks Lab",
  CSE323: "Operating Systems",
  CSE325: "Data Mining",
  CSE328: "Software Engineering",
  CSE412: "Artificial Intelligence",
  CSE414: "Simulation and Modeling",
  CSE421: "Computer Graphics",
  MAT101: "Mathematics - I",
  MAT211: "Mathematics - II",
  PHY101: "Physics - I",
  PHY102: "Physics - II",
  PHY103: "Physics Lab",
  ENG101: "English",
  ENG102: "English",
  BNS101: "Bangladesh Studies",
  CSE121: "Discrete Mathematics",
  CSE212: "Algorithms",
  CSE223: "Digital System Design",
  CSE225: "Data Communication",
  CSE228: "Microprocessor",
  CSE326: "Information System Analysis",
  CSE422: "AI Lab",
};

export class PDFParserV2 {
  /**
   * Download and parse PDF from URL
   */
  async parsePDFFromURL(url: string): Promise<ParsedSchedule> {
    try {
      // Download PDF
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
      });

      const pdfBuffer = Buffer.from(response.data);

      // Parse PDF
      const data = await pdfParse(pdfBuffer);
      const text = data.text;

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
    }
  }

  /**
   * Extract class schedules from PDF text
   * 
   * The PDF table columns are merged into single lines like:
   * "KT-222KT-222CSE112(71_I)MBKT-222KT-222MAT101(71_I)ASTKT-222"
   * 
   * Pattern for each class entry:
   * Room + Course(Batch_Section) + Teacher
   * e.g., "KT-222CSE112(71_I)MB"
   */
  private extractClasses(text: string): ClassSchedule[] {
    const classes: ClassSchedule[] = [];
    const lines = text.split("\n").map((line) => line.trim());

    let currentDay = "";
    let currentTimeSlots: Array<{ start: string; end: string }> = [];

    // Pattern to match: Room + Course(Batch_Section) + Teacher
    // Example: KT-222CSE112(71_I)MB or G1-026CSE115(71_I)TAS
    const entryPattern = /([A-Z]{1,2}-\d{2,3}(?:\([A-Z]\))?|G\d-\d{3})([A-Z]{3}\d{3})\((\d{2,3})_([A-Z]\d?)\)([A-Z]{2,4}?(?:_\d+)?(?=[A-Z]{1,2}-|G\d-|$))/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this is a day header
      const dayUpper = line.toUpperCase();
      if (DAYS.includes(dayUpper)) {
        currentDay = dayUpper;
        currentTimeSlots = [];
        
        // Extract time slots from the next few lines
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const timeLine = lines[j];
          const timePattern = /(\d{2}:\d{2})-(\d{2}:\d{2})/;
          const match = timePattern.exec(timeLine);
          if (match) {
            currentTimeSlots.push({ start: match[1], end: match[2] });
          }
        }
        
        continue;
      }

      // Skip if no current day
      if (!currentDay) continue;

      // Find all class entries in this line
      let match;
      while ((match = entryPattern.exec(line)) !== null) {
        const [fullMatch, room, courseCode, batch, section, teacher] = match;
        
        // Use first time slot as default
        const timeSlot = currentTimeSlots.length > 0 
          ? currentTimeSlots[0] 
          : { start: "08:30", end: "10:00" };

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
          room,
          teacher,
          batchSection,
        };

        classes.push(classEntry);
      }
    }

    return classes;
  }

  /**
   * Calculate schedule statistics
   */
  calculateStats(classes: ClassSchedule[]): ScheduleStats {
    if (classes.length === 0) {
      return {
        totalClasses: 0,
        busiestDay: "N/A",
        lightestDay: "N/A",
        busiestDayCount: 0,
        lightestDayCount: 0,
      };
    }

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
export const pdfParserV2 = new PDFParserV2();
