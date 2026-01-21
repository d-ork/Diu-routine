#!/bin/bash
# Run this script in Render Shell to initialize the database

echo "Initializing DIU Routine Scrapper database..."

psql $DATABASE_URL << 'EOF'
-- DIU Routine Scrapper - PostgreSQL Database Initialization

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  "loginMethod" VARCHAR(64),
  role VARCHAR(20) DEFAULT 'user' NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "lastSignedIn" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create faculty table
CREATE TABLE IF NOT EXISTS faculty (
  id SERIAL PRIMARY KEY,
  "fullName" TEXT NOT NULL,
  initials VARCHAR(10) NOT NULL UNIQUE,
  department VARCHAR(50) DEFAULT 'cse' NOT NULL,
  "photoUrl" TEXT,
  "profileUrl" TEXT,
  email VARCHAR(320),
  phone VARCHAR(20),
  room VARCHAR(50),
  designation TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create pdfCache table
CREATE TABLE IF NOT EXISTS "pdfCache" (
  id SERIAL PRIMARY KEY,
  department VARCHAR(50) NOT NULL,
  "pdfUrl" TEXT NOT NULL,
  version VARCHAR(20) DEFAULT '1.0' NOT NULL,
  "parsedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "totalClasses" INTEGER DEFAULT 0 NOT NULL
);

-- Create classSchedules table
CREATE TABLE IF NOT EXISTS "classSchedules" (
  id SERIAL PRIMARY KEY,
  "cacheId" INTEGER NOT NULL,
  day VARCHAR(20) NOT NULL,
  "timeStart" VARCHAR(10) NOT NULL,
  "timeEnd" VARCHAR(10) NOT NULL,
  "courseCode" VARCHAR(20) NOT NULL,
  "courseName" TEXT,
  batch VARCHAR(10) NOT NULL,
  section VARCHAR(10) NOT NULL,
  "batchSection" VARCHAR(20) NOT NULL,
  room VARCHAR(50) NOT NULL,
  teacher VARCHAR(20) NOT NULL,
  department VARCHAR(50) DEFAULT 'cse' NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_faculty_initials ON faculty(initials);
CREATE INDEX IF NOT EXISTS idx_faculty_department ON faculty(department);
CREATE INDEX IF NOT EXISTS idx_pdfcache_department ON "pdfCache"(department);
CREATE INDEX IF NOT EXISTS idx_classschedules_cacheid ON "classSchedules"("cacheId");
CREATE INDEX IF NOT EXISTS idx_classschedules_batchsection ON "classSchedules"("batchSection");
CREATE INDEX IF NOT EXISTS idx_classschedules_teacher ON "classSchedules"(teacher);
CREATE INDEX IF NOT EXISTS idx_classschedules_room ON "classSchedules"(room);

-- Verify tables were created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('users', 'faculty', 'pdfCache', 'classSchedules')
ORDER BY table_name;
EOF

echo ""
echo "✅ Database initialization complete!"
echo "Tables created: users, faculty, pdfCache, classSchedules"
