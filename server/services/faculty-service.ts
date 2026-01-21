import { getDb } from "../db";
import { faculty as facultyTable } from "../../drizzle/schema";
import { FacultyScraper } from "./faculty-scraper";
import { eq } from "drizzle-orm";

export class FacultyService {
  /**
   * Get all faculty from database
   */
  static async getAllFaculty(department: string = "cse") {
    const db = await getDb();
    if (!db) return [];
    
    const result = await db
      .select()
      .from(facultyTable)
      .where(eq(facultyTable.department, department));
    
    return result;
  }

  /**
   * Get faculty by initials
   */
  static async getFacultyByInitials(initials: string) {
    const db = await getDb();
    if (!db) return null;
    
    const result = await db
      .select()
      .from(facultyTable)
      .where(eq(facultyTable.initials, initials.toUpperCase()))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Scrape and store faculty data
   * Returns cached data if available and fresh (< 7 days old)
   */
  static async scrapeAndStoreFaculty(department: string = "cse", forceRefresh: boolean = false) {
    const db = await getDb();
    if (!db) {
      console.warn("Database not available, returning scraped data only");
      return await FacultyScraper.scrapeFaculty(department);
    }
    // Check if we have cached data
    if (!forceRefresh) {
      const cached = await this.getAllFaculty(department);
      if (cached.length > 0) {
        // Check if data is fresh (less than 7 days old)
        const oldestEntry = cached.sort((a: any, b: any) => 
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        )[0];
        
        const daysSinceUpdate = (Date.now() - new Date(oldestEntry.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceUpdate < 7) {
          console.log(`Using cached faculty data (${daysSinceUpdate.toFixed(1)} days old)`);
          return cached;
        }
      }
    }

    // Scrape fresh data
    console.log(`Scraping faculty from DIU website (department: ${department})...`);
    const scrapedFaculty = await FacultyScraper.scrapeFaculty(department);

    // Store in database
    const stored = [];
    for (const member of scrapedFaculty) {
      try {
        // Check if exists
        const existing = await this.getFacultyByInitials(member.initials);
        
        if (existing) {
          // Update
          await db
            .update(facultyTable)
            .set({
              fullName: member.name,
              photoUrl: member.photoUrl,
              // profileUrl: member.profileUrl,
              updatedAt: new Date(),
            })
            .where(eq(facultyTable.initials, member.initials));
          
          stored.push({ ...existing, ...member });
        } else {
          // Insert
          const [inserted] = await db
            .insert(facultyTable)
            .values({
              fullName: member.name,
              initials: member.initials,
              department,
              photoUrl: member.photoUrl,
              // profileUrl: member.profileUrl,
            });
          
          stored.push(inserted);
        }
      } catch (error) {
        console.error(`Error storing faculty ${member.initials}:`, error);
      }
    }

    console.log(`Stored ${stored.length} faculty members in database`);
    return stored;
  }

  /**
   * Generate initials from full name
   */
  static generateInitials(fullName: string): string {
    // Remove titles
    const titles = ["Md.", "Dr.", "Prof.", "Mr.", "Mrs.", "Ms.", "Engr."];
    let name = fullName;
    
    for (const title of titles) {
      name = name.replace(new RegExp(`^${title}\\s+`, "i"), "");
    }

    // Split by spaces and take first letter of each word
    const words = name.trim().split(/\s+/);
    const initials = words
      .map(word => word.charAt(0).toUpperCase())
      .join("");

    return initials;
  }
}
