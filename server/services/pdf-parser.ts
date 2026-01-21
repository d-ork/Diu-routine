const pdf = require("pdf-parse");
import axios from "axios";
import type { ClassSchedule } from "../../types";

export class PDFParser {
  /**
   * Parse PDF from URL and extract class schedules
   */
  static async parsePDFFromUrl(pdfUrl: string): Promise<ClassSchedule[]> {
    try {
      const response = await axios.get(pdfUrl, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const dataBuffer = Buffer.from(response.data);
      const pdfData = await pdf(dataBuffer);
      const text = pdfData.text;

      return this.extractSchedules(text);
    } catch (error) {
      console.error("Error parsing PDF:", error);
      return [];
    }
  }

  /**
   * Extract class schedules from PDF text
   */
  private static extractSchedules(text: string): ClassSchedule[] {
    const schedules: ClassSchedule[] = [];
    const lines = text.split("\n");

    let currentDay = "";
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect day of week
      const dayMatch = line.match(/^(Saturday|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday)/i);
      if (dayMatch) {
        currentDay = dayMatch[1];
        continue;
      }

      // Skip if no current day
      if (!currentDay) continue;

      // Extract class information
      // Pattern: CSE112(71_I) or CSE112 (71_I) or similar
      const classPattern = /([A-Z]{2,4}\d{3})\s*\((\d+)_([A-Z])\)/g;
      let match;

      while ((match = classPattern.exec(line)) !== null) {
        const courseCode = match[1];
        const batch = match[2];
        const section = match[3];

        // Try to extract time (e.g., 10:00-11:30 or 10:00)
        const timePattern = /(\d{1,2}:\d{2})\s*-?\s*(\d{1,2}:\d{2})?/;
        const timeMatch = line.match(timePattern);
        const timeStart = timeMatch ? timeMatch[1] : "00:00";
        const timeEnd = timeMatch && timeMatch[2] ? timeMatch[2] : timeStart;

        // Try to extract room (e.g., KT-222, G1-020)
        const roomPattern = /([A-Z]{1,2}\d?-\d{3})/;
        const roomMatch = line.match(roomPattern);
        const room = roomMatch ? roomMatch[1] : "TBA";

        // Try to extract room type (e.g., COM LAB)
        const roomTypePattern = /\((COM LAB|LAB|LECTURE|TUTORIAL)\)/i;
        const roomTypeMatch = line.match(roomTypePattern);
        const roomType = roomTypeMatch ? roomTypeMatch[1] : undefined;

        // Try to extract teacher initials (2-4 uppercase letters)
        const teacherPattern = /\b([A-Z]{2,4})\b/g;
        const teacherMatches = line.match(teacherPattern);
        const teacherInitials = teacherMatches && teacherMatches.length > 0 
          ? teacherMatches[teacherMatches.length - 1] 
          : "TBA";

        // Try to extract course name (usually before the course code or after)
        const courseNamePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;
        const courseNameMatch = line.match(courseNamePattern);
        const courseName = courseNameMatch ? courseNameMatch[1] : courseCode;

        schedules.push({
          id: `${currentDay}-${timeStart}-${courseCode}-${batch}_${section}`,
          day: currentDay,
          timeStart,
          timeEnd,
          courseCode,
          courseName,
          batch,
          section,
          room,
          roomType,
          teacherInitials,
        });
      }
    }

    return schedules;
  }

  /**
   * Filter schedules by batch and section
   */
  static filterByBatchSection(schedules: ClassSchedule[], batchSection: string): ClassSchedule[] {
    // Handle formats: "71_I", "71I", "71 I"
    const normalized = batchSection.toUpperCase().replace(/\s+/g, "_");
    const parts = normalized.split("_");
    
    if (parts.length < 2) {
      // Try to split by last character
      const batch = normalized.slice(0, -1);
      const section = normalized.slice(-1);
      return schedules.filter(s => s.batch === batch && s.section === section);
    }

    const [batch, section] = parts;
    return schedules.filter(s => s.batch === batch && s.section === section);
  }

  /**
   * Filter schedules by teacher initials
   */
  static filterByTeacher(schedules: ClassSchedule[], teacherInitials: string): ClassSchedule[] {
    return schedules.filter(s => s.teacherInitials === teacherInitials.toUpperCase());
  }

  /**
   * Filter schedules by room
   */
  static filterByRoom(schedules: ClassSchedule[], room: string): ClassSchedule[] {
    return schedules.filter(s => s.room === room.toUpperCase());
  }

  /**
   * Group schedules by day
   */
  static groupByDay(schedules: ClassSchedule[]): Record<string, ClassSchedule[]> {
    const grouped: Record<string, ClassSchedule[]> = {};
    
    schedules.forEach(schedule => {
      if (!grouped[schedule.day]) {
        grouped[schedule.day] = [];
      }
      grouped[schedule.day].push(schedule);
    });

    // Sort by time within each day
    Object.keys(grouped).forEach(day => {
      grouped[day].sort((a, b) => {
        const timeA = a.timeStart.split(":").map(Number);
        const timeB = b.timeStart.split(":").map(Number);
        return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
      });
    });

    return grouped;
  }

  /**
   * Calculate statistics
   */
  static calculateStats(schedules: ClassSchedule[]): {
    totalClasses: number;
    busiestDay: { day: string; count: number };
    lightestDay: { day: string; count: number };
  } {
    const grouped = this.groupByDay(schedules);
    const days = Object.keys(grouped);

    if (days.length === 0) {
      return {
        totalClasses: 0,
        busiestDay: { day: "N/A", count: 0 },
        lightestDay: { day: "N/A", count: 0 },
      };
    }

    const counts = days.map(day => ({ day, count: grouped[day].length }));
    counts.sort((a, b) => b.count - a.count);

    return {
      totalClasses: schedules.length,
      busiestDay: counts[0],
      lightestDay: counts[counts.length - 1],
    };
  }
}
