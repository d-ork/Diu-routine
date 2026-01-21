# DIU Routine Scrapper iOS - Design Document

## App Overview

A class schedule management app for Daffodil International University students that scrapes routine data from the university noticeboard, parses PDF schedules, integrates faculty information with photos, and displays personalized timetables based on batch and section.

## Design Philosophy

**Exact Android app replication** - Match the Android version's UI, UX, and features precisely while adapting to iOS conventions only where necessary for platform compliance.

## Color Palette

Based on Android app screenshots:

- **Primary**: Purple/Blue (#6366F1)
- **Background**: Very Dark Blue (#0F172A)
- **Surface**: Dark Gray (#1E293B)
- **Text**: White (#FFFFFF)
- **Muted**: Light Gray (#94A3B8)
- **Accent**: Blue (#3B82F6)
- **Success**: Green (#10B981)

## Screen Breakdown

### Student Tab (Main)

**Header:**
- App icon (left)
- "Student" title
- "Online" status badge (green)
- Chat icon
- Menu icon (hamburger)

**Search Section:**
- Search bar with magnifying glass
- Department dropdown (CSE, EEE, etc.)
- Active search tag chip (e.g., "71_I ×")

**Results Card:**
- Collapsible "Enrolled Courses" section
- CR button, Notification bell
- Stats display: Batch, Section, Total Courses, Routine Version, Classes per Week
- "Download PDF for 71_I" button
- Faculty photos row (4 circular avatars with initials, online indicators)

**View Toggle:**
- "Day View" and "Week View" buttons

**Content Area:**
- Changes based on selected view

### Week View

**Statistics Cards (3 across):**
1. Total Classes (calendar icon, number, label)
2. Busiest Day (fire icon, day name, class count)
3. Lightest Day (leaf icon, day name, class count)

**Timetable Grid:**
- Header: Time slots
- Rows: Days (Saturday-Friday)
- Cells: Course cards showing code, room, teacher

### Day View

**Date Selector:**
- Horizontal scrollable row
- Date cards (number + day name)
- Current date highlighted

**Timeline:**
- Vertical list
- Time markers on left
- Class cards showing:
  - Course name
  - Course code
  - Section
  - Teacher (clickable blue)
  - Room
- Break time cards (striped, coffee emoji)

### Teacher Tab

- Faculty directory
- Search functionality
- Faculty cards with photo, name, initials

### Room Tab

- Room directory
- Room schedule viewer

### Empty Tab

- TBD

## Bottom Navigation

4 tabs: Student, Teacher, Room, Empty
Icons + labels, purple active color

## Data Sources

1. **DIU Noticeboard**: https://daffodilvarsity.edu.bd/noticeboard
2. **Faculty Directory**: https://faculty.daffodilvarsity.edu.bd/teachers/cse/

## Key Features

1. Batch/section search (e.g., "71_I")
2. PDF parsing and schedule extraction
3. Faculty photo integration
4. Week/Day view timetables
5. Teacher profile linking
6. PDF download
