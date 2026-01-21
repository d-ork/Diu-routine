// Core data types for DIU Routine Scrapper

export interface Faculty {
  id: string;
  name: string;
  initials: string;
  photoUrl: string;
  department: string;
  designation?: string;
  email?: string;
  phone?: string;
  room?: string;
  profileUrl?: string;
}

export interface ClassSchedule {
  id: string;
  day: string; // Saturday, Sunday, Monday, etc.
  timeStart: string; // 10:00
  timeEnd: string; // 11:30
  courseCode: string; // CSE112
  courseName: string; // Computer Fundamentals
  batch: string; // 71
  section: string; // I
  room: string; // KT-222
  roomType?: string; // COM LAB
  teacherInitials: string; // MB
  teacherName?: string; // Full name if available
}

export interface RoutineData {
  id: string;
  department: string;
  batch: string;
  section: string;
  version: string;
  pdfUrl: string;
  classes: ClassSchedule[];
  createdAt: string;
}

export interface TeacherSchedule {
  teacherInitials: string;
  teacherName?: string;
  sections: string[]; // ["71_H", "71_I", "66_B"]
  totalCourses: number;
  classesPerWeek: number;
  classes: ClassSchedule[];
}

export interface RoomSchedule {
  roomNumber: string;
  roomType?: string;
  classes: ClassSchedule[];
}

export interface DayStats {
  totalClasses: number;
  busiestDay: { day: string; count: number };
  lightestDay: { day: string; count: number };
}

export const DAYS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

export const DEPARTMENTS = [
  { code: "CSE", name: "Computer Science & Engineering", color: "#6366F1" },
  { code: "EEE", name: "Electrical & Electronic Engineering", color: "#F59E0B" },
  { code: "AGS", name: "Agriculture", color: "#10B981" },
  { code: "CE", name: "Civil Engineering", color: "#EF4444" },
  { code: "MCT", name: "Multimedia & Creative Technology", color: "#8B5CF6" },
  { code: "SWE", name: "Software Engineering", color: "#3B82F6" },
  { code: "ICE", name: "Information & Communication Engineering", color: "#EC4899" },
  { code: "Architecture", name: "Architecture", color: "#14B8A6" },
] as const;

export type Department = typeof DEPARTMENTS[number]["code"];
export type DayOfWeek = typeof DAYS[number];
