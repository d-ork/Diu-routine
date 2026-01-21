import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { PdfCacheService } from "../services/pdf-cache-service";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// Pre-warm cache for common departments to speed up first requests
async function prewarmCache() {
  const commonDepartments = [
    { dept: "cse", url: "https://daffodilvarsity.edu.bd/noticeFile/cse-class-routine-spring-2026-v1-8d732090c2.pdf" },
    { dept: "eee", url: "https://daffodilvarsity.edu.bd/noticeFile/eee-class-routine-spring-2026-v1.pdf" },
    { dept: "swe", url: "https://daffodilvarsity.edu.bd/noticeFile/swe-class-routine-spring-2026-v1.pdf" },
  ];

  console.log("[cache] Pre-warming cache for common departments...");
  
  for (const { dept, url } of commonDepartments) {
    try {
      const status = await PdfCacheService.getCacheStatus(dept);
      if (!status.isCached) {
        console.log(`[cache] Pre-warming ${dept}...`);
        await PdfCacheService.getOrParsePdf(dept, url, "1.0");
        console.log(`[cache] ✓ ${dept} cached`);
      } else {
        console.log(`[cache] ✓ ${dept} already cached`);
      }
    } catch (error: any) {
      console.error(`[cache] Failed to pre-warm ${dept}:`, error.message);
    }
  }
  
  console.log("[cache] Pre-warming complete");
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  // Health check endpoints for monitoring
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    
    // Pre-warm cache for common departments (async, non-blocking)
    prewarmCache().catch((err) => {
      console.error("[cache] Pre-warming failed:", err.message);
    });
  });
}

startServer().catch(console.error);
