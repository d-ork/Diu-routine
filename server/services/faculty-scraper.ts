import axios from "axios";
import * as cheerio from "cheerio";
import type { Faculty } from "../../types";

export class FacultyScraper {
  private static readonly BASE_URL = "https://faculty.daffodilvarsity.edu.bd";
  private static readonly BATCH_SIZE = 10; // Process 10 profiles in parallel
  
  /**
   * Scrape all faculty members from a department
   * Pagination uses offset: /teachers/cse, /teachers/cse/20, /teachers/cse/40, etc.
   * @param department Department code (e.g., "cse")
   * @param maxPages Maximum number of pages to scrape (default: unlimited)
   */
  static async scrapeFaculty(department: string = "cse", maxPages: number = 999): Promise<Faculty[]> {
    const allFaculty: Faculty[] = [];
    let offset = 0;
    const PAGE_SIZE = 20;
    let hasMore = true;

    console.log(`[FacultyScraper] Starting to scrape ${department.toUpperCase()} faculty...`);

    // Step 1: Scrape listing pages to get basic info and profile URLs
    while (hasMore) {
      try {
        const url = offset === 0 
          ? `${this.BASE_URL}/teachers/${department}`
          : `${this.BASE_URL}/teachers/${department}/${offset}`;
        
        console.log(`[FacultyScraper] Fetching page at offset ${offset}: ${url}`);
        
        const response = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          timeout: 10000,
        });

        const $ = cheerio.load(response.data);
        let facultyCount = 0;

        $("li").each((_, element) => {
          const $li = $(element);
          const $nameLink = $li.find("h3 a, h4 a");
          const name = $nameLink.text().trim();
          
          if (!name || name.length <= 3) return;
          
          const designation = $li.find("h4, .designation").text().trim();
          const $img = $li.find("img");
          const photoUrl = $img.attr("src") || "";
          const profileUrl = $nameLink.attr("href") || "";

          const initials = this.generateInitials(name);
          
          let fullProfileUrl = "";
          if (profileUrl) {
            fullProfileUrl = profileUrl.startsWith("http") 
              ? profileUrl 
              : `${this.BASE_URL}${profileUrl}`;
          }
          
          allFaculty.push({
            id: initials,
            name,
            initials,
            photoUrl: photoUrl.startsWith("http") ? photoUrl : `${this.BASE_URL}${photoUrl}`,
            department: department.toUpperCase(),
            designation: designation || "Faculty Member",
            email: "",
            phone: "",
            room: "",
            profileUrl: fullProfileUrl,
          });
          
          facultyCount++;
        });

        console.log(`[FacultyScraper] Found ${facultyCount} faculty members at offset ${offset}`);

        if (facultyCount < PAGE_SIZE) {
          hasMore = false;
          console.log(`[FacultyScraper] Reached end of faculty list`);
        } else {
          offset += PAGE_SIZE;
        }
        
        const currentPage = (offset / PAGE_SIZE) + 1;
        if (currentPage >= maxPages) {
          console.log(`[FacultyScraper] Reached maxPages limit (${maxPages})`);
          hasMore = false;
        }
        
        if (offset > 500) {
          console.log(`[FacultyScraper] Safety limit reached`);
          hasMore = false;
        }
      } catch (error) {
        console.error(`[FacultyScraper] Error scraping page at offset ${offset}:`, error);
        hasMore = false;
      }
    }

    console.log(`[FacultyScraper] Completed scraping listing pages. Total faculty: ${allFaculty.length}`);
    
    // Step 2: Scrape profile pages in parallel batches
    console.log(`[FacultyScraper] Starting parallel profile scraping (batch size: ${this.BATCH_SIZE})...`);
    await this.enrichWithProfileDataParallel(allFaculty);
    
    return allFaculty;
  }

  /**
   * Enrich faculty data by scraping profile pages in parallel batches
   */
  private static async enrichWithProfileDataParallel(faculty: Faculty[]): Promise<void> {
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;
    
    // Filter faculty with profile URLs
    const facultyWithProfiles = faculty.filter(f => f.profileUrl);
    const totalToScrape = facultyWithProfiles.length;
    
    console.log(`[FacultyScraper] Scraping ${totalToScrape} profile pages...`);
    
    // Process in batches
    for (let i = 0; i < facultyWithProfiles.length; i += this.BATCH_SIZE) {
      const batch = facultyWithProfiles.slice(i, i + this.BATCH_SIZE);
      const batchNum = Math.floor(i / this.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(facultyWithProfiles.length / this.BATCH_SIZE);
      
      console.log(`[FacultyScraper] Processing batch ${batchNum}/${totalBatches} (${batch.length} profiles)`);
      
      // Scrape all profiles in this batch in parallel
      const results = await Promise.allSettled(
        batch.map(member => this.scrapeProfilePage(member))
      );
      
      // Count successes and failures
      results.forEach(result => {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          failCount++;
        }
      });
      
      // Progress update
      const progress = ((i + batch.length) / totalToScrape * 100).toFixed(1);
      console.log(`[FacultyScraper] Progress: ${progress}% (${successCount} success, ${failCount} failed)`);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[FacultyScraper] Profile scraping complete in ${duration}s. Success: ${successCount}, Failed: ${failCount}`);
  }

  /**
   * Scrape a single faculty profile page
   */
  private static async scrapeProfilePage(member: Faculty): Promise<void> {
    if (!member.profileUrl) return;
    
    try {
      const response = await axios.get(member.profileUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 8000,
      });
      
      const $ = cheerio.load(response.data);
      
      // Extract contact information from DIV-based layout
      // Structure: <div>Label</div><div>Value</div>
      $("div").each((_, element) => {
        const $div = $(element);
        const label = $div.text().trim().toLowerCase();
        const $nextDiv = $div.next("div");
        const value = $nextDiv.text().trim();
        
        // Only process if this looks like a label and has a next sibling
        if (!value || value.length > 100) return;
        
        if (label === "e-mail" || label === "email") {
          const emails = value.split(",").map(e => e.trim());
          member.email = emails[0] || "";
        } else if (label === "cell-phone" || label === "cell phone") {
          member.phone = value;
        } else if (label === "phone") {
          // Prefer cell phone over office phone
          if (!member.phone) {
            member.phone = value;
          }
        } else if (label === "room" || label === "office") {
          member.room = value;
        }
      });
    } catch (error) {
      // Silent fail - profile page might not exist or be inaccessible
      // We'll just keep the empty contact fields
    }
  }

  /**
   * Generate initials from full name
   */
  static generateInitials(fullName: string): string {
    const titles = ["md", "dr", "prof", "mr", "mrs", "ms", "engr", "professor", "doctor", "muhammed", "mohammed"];
    
    const words = fullName
      .split(/\s+/)
      .filter(word => {
        const lowerWord = word.toLowerCase().replace(/\./g, "");
        return !titles.includes(lowerWord) && word.length > 0;
      });

    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    } else if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }

    return "";
  }

  /**
   * Find faculty by initials
   */
  static findByInitials(faculty: Faculty[], initials: string): Faculty | undefined {
    return faculty.find(f => f.initials === initials);
  }
}
