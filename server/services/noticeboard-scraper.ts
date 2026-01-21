import axios from "axios";
import * as cheerio from "cheerio";

export interface DepartmentRoutine {
  department: string;
  title: string;
  pdfUrl: string;
  version: string;
  date: string;
}

const DEPARTMENT_KEYWORDS = {
  cse: ["CSE", "Computer Science"],
  eee: ["EEE", "Electrical"],
  swe: ["SWE", "Software Engineering"],
  ags: ["AGS", "Agricultural"],
  ce: ["CE", "Civil Engineering"],
  mct: ["MCT", "Multimedia"],
  ice: ["ICE", "Information and Communication"],
  architecture: ["Architecture"],
};

/**
 * Scrape DIU noticeboard to find latest routine PDFs for all departments
 */
export async function scrapeNoticeboardRoutines(): Promise<DepartmentRoutine[]> {
  try {
    const response = await axios.get("https://daffodilvarsity.edu.bd/noticeboard", {
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const routines: DepartmentRoutine[] = [];

    // Find all notice links containing "routine" or "class schedule"
    $("a").each((_, element) => {
      const $el = $(element);
      const text = $el.text().trim();
      const href = $el.attr("href");

      if (!href || !text) return;

      const lowerText = text.toLowerCase();
      if (
        (lowerText.includes("routine") || lowerText.includes("class schedule")) &&
        !lowerText.includes("advising") &&
        !lowerText.includes("exam")
      ) {
        // Determine department
        let department = "unknown";
        for (const [dept, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
          if (keywords.some((keyword) => text.includes(keyword))) {
            department = dept;
            break;
          }
        }

        if (department !== "unknown") {
          // Extract version if present
          const versionMatch = text.match(/[Vv](?:ersion)?\s*(\d+\.?\d*)/);
          const version = versionMatch ? versionMatch[1] : "1.0";

          routines.push({
            department,
            title: text,
            pdfUrl: "", // Will be fetched from detail page
            version,
            date: new Date().toISOString(),
          });
        }
      }
    });

    return routines;
  } catch (error) {
    console.error("Failed to scrape noticeboard:", error);
    return [];
  }
}

/**
 * Get PDF URL for a specific notice
 */
export async function getNoticePdfUrl(noticeUrl: string): Promise<string | null> {
  try {
    const response = await axios.get(noticeUrl, {
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    // Find PDF link
    let pdfUrl: string | null = null;
    $("a").each((_, element) => {
      const href = $(element).attr("href");
      if (href && href.toLowerCase().endsWith(".pdf")) {
        pdfUrl = href.startsWith("http") ? href : `https://daffodilvarsity.edu.bd${href}`;
        return false; // Break loop
      }
    });

    return pdfUrl;
  } catch (error) {
    console.error("Failed to get PDF URL:", error);
    return null;
  }
}

/**
 * Get latest routine PDF URL for a specific department
 */
export async function getLatestRoutinePdfUrl(department: string): Promise<string | null> {
  try {
    const response = await axios.get("https://daffodilvarsity.edu.bd/noticeboard", {
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const keywords = DEPARTMENT_KEYWORDS[department as keyof typeof DEPARTMENT_KEYWORDS] || [];

    // Find the first matching routine notice
    let noticeHref: string | null = null;
    $("a").each((_, element) => {
      const $el = $(element);
      const text = $el.text().trim();
      const href = $el.attr("href");

      if (!href || !text) return;

      const lowerText = text.toLowerCase();
      if (
        (lowerText.includes("routine") || lowerText.includes("class schedule")) &&
        !lowerText.includes("advising") &&
        !lowerText.includes("exam") &&
        keywords.some((keyword) => text.includes(keyword))
      ) {
        noticeHref = href.startsWith("http") ? href : `https://daffodilvarsity.edu.bd${href}`;
        return false; // Break loop
      }
    });

    if (!noticeHref) {
      console.log(`No routine found for department: ${department}`);
      return null;
    }

    // Get PDF URL from notice detail page
    const pdfUrl = await getNoticePdfUrl(noticeHref);
    return pdfUrl;
  } catch (error) {
    console.error(`Failed to get routine PDF for ${department}:`, error);
    return null;
  }
}
