# NanoHab Portal — Clinical Admin App

## Overview
A professional clinical exercise prescription management portal for speech-language pathologists. Covers authentication, dashboard, patient management, and exercise library.

---

## Features

### Login Screen
- Two-tab login: **Admin** (Supabase Auth) and **Clinician** (custom table auth with SHA-256 hashed password)
- Professional medical branding with NanoHab logo area and warm accent color
- "Remember me" toggle and secure password field
- Bilingual labels (English + 繁體中文)

### Dashboard (Home)
- Summary cards showing: total active patients, active programs count
- Admin-only cards: pending media requests, pending rental requests
- Recent notifications list at the bottom
- Pull-to-refresh on all data
- Role-aware content (Admins see everything, Clinicians see filtered data)

### Patients List
- Searchable, scrollable list of patients
- Each patient card shows: name, access code, diagnosis, status badge (active/frozen)
- Add new patient button (floating action button)
- Edit patient details in a modal/screen
- Freeze/unfreeze patient toggle
- Clinicians only see their own patients; Admins see all
- Pull-to-refresh support

### Exercise Library
- Fetch exercises from `exercise_library` table
- Admin sees all exercises; clinicians see shared exercises (via `shared_exercises`) + own uploads (`created_by_clinician_id`)
- Exercise cards show: title (localized), category badge, media badges (Vimeo/YouTube/Audio), duration
- Search by title and filter by category dropdown
- Admin can edit any exercise; clinicians can only edit their own (shared = read-only with badge)
- Clinicians creating a new exercise must complete "Request Media Setup" sheet before saving
- Media request sheet: checkboxes (Video required, Audio optional, Subtitle optional, Live Subtitles optional), video URL, notes, declaration checkbox
- On submit: saves exercise with `media_status = 'pending_review'`, inserts into `exercise_media_requests`
- Status badges: 🟡 Pending Review, 🟢 Active, 🔴 Rejected

### Program Builder
- Patient selector at top (filtered by clinician for clinician role)
- Shows all active programs for selected patient
- Each program card shows: program name (localized), schedule badge (Daily/custom days), exercise count, issue/expiry dates
- "New Program" form: program name (EN/繁中/简中), issue date, expiry date, schedule type (daily/custom + day checkboxes), sort order, remarks
- Exercise picker: scrollable list of exercises from library, tap "+" to add, reorder with up/down arrows
- Each program exercise shows: title, duration, inline dosage fields (sets, reps, duration seconds), notes
- Save creates/updates `exercise_programs` + `exercises` + `program_schedules` tables
- Delete program with confirmation
- Permission-gated: respects `can_view_programs` and `can_create_programs`

### Marketplace (Clinician Feature)
- **Browse Marketplace**: Grid of approved active listings from `marketplace_listings`. Each card shows thumbnail, exercise name, HKD/day rate, tags, rating stars. Search bar + category filter + sort options. Tap card opens detail modal with screenshot carousel, full description, contraindications, discount tiers, reviews, "Request to Rent" button.
- **My Listings**: List of clinician's own listings with approval status, active rental count, total earned. "List New Exercise" button (only exercises owned with `media_status = 'active'`). Submit creates listing with `approval_status = 'pending'`.
- **Rental Logbook**: Two tabs — "My Rentals" (exercises renting via `marketplace_rentals WHERE renting_clinician_id = me`) and "My Listings" (rental requests for own exercises). Shows status badges, dates, fees, actions (extend, cancel, review, dispute).

### Admin Hub (Admin-only)
- Conditionally visible Admin tab (Shield icon) — only shown when `isAdmin === true`
- Scrollable grid of admin section cards with bilingual labels and count badges
- **Clinician Management**: Full CRUD for clinicians table with search, tier picker, is_active/is_approved toggles, 10 permission override segmented controls (Default/Allow/Deny), reset password via SHA-256
- **Notifications Management**: CRUD for notifications table with type badges (info/warning/success/alert), add/edit modal, delete with confirmation
- **Media Requests**: List from `exercise_media_requests` joined with exercise & clinician info, approve/reject actions with reason input, updates exercise `media_status`
- **User Feedback**: List from `user_feedback` with rating stars, status filter (All/New/Read/Resolved), detail view with admin notes and status change
- **Organisations**: CRUD for organisations table (graceful fallback if table doesn't exist)
- **Shared Exercises**: List from `shared_exercises` with exercise/clinician pickers, add via upsert on conflict, delete with confirmation
- **Assessments**: List from `assessment_library` (graceful fallback if table doesn't exist), basic CRUD with category badges
- **Splash Ads**: Full CRUD for `splash_ads` table — list with thumbnails, target type badges, date ranges, active toggle; add/edit modal with all fields
- **Knowledge Videos**: Full CRUD for `knowledge_videos` table — list with YouTube/Vimeo thumbnails, category badges, duration, creator info; bilingual add/edit modal
- **Feeding Skills**: Full CRUD for `feeding_skill_videos` table — list with video thumbnails, category badges, creator info; bilingual add/edit modal
- **Flower Garden**: Two-tab admin screen — "Flower Types" tab with full CRUD for `flower_types` table (rarity badges, image preview, weight); "Patient Flowers" tab with read-only list from `patient_flowers` joined with patients and flower types (rarity, acquired method, stolen status)
- **Marketing Draws**: Two-tab admin screen — "Campaigns" tab with full CRUD for `marketing_campaigns` table (trigger badges, date range, max draws/day); "Prizes" tab with full CRUD for `marketing_prizes` filtered by selected campaign (prize type, quantity remaining/total, probability weight, expiry)
- **Reinforcement Audio**: Full CRUD for `reinforcement_audio_library` table — list with source badges (YouTube EN/繁/简, Audio EN/繁/简), is_default gold badge; add/edit modal with all YouTube IDs and audio URLs
- **Therapist Settings**: Per-patient therapist name/photo management — list all patients with current therapist_name_en/zh and photo/cartoon thumbnails; tap to edit modal with URL inputs and preview
- **Managing Org**: Two-section screen — "Default Org Settings" form (reads/writes app_config table for default org name/logo) with "Apply to All" bulk update; "Per-Patient Overrides" list with search, tap to edit individual patient's managing_org fields

### Settings
- Profile info display
- Logout button
- About page with copyright and creator credits

---

## Design
- **Color scheme**: Clean white/light grey backgrounds with a warm orange accent (#E07A3A), dark text for readability
- **Style**: Professional medical aesthetic — think clinical portal meets modern iOS design
- **Cards**: Rounded white cards with subtle shadows, clear visual hierarchy
- **Navigation**: Tab bar with Home, Patients, Exercises, Programs, Market, Admin (admin-only), and Settings tabs
- **Typography**: Clean, legible fonts with bilingual support
- **Anti-screenshot**: Screen capture prevention enabled app-wide

---

## Screens

1. **Login** — Full-screen login with Admin/Clinician tab switcher, email + password fields, sign-in button
2. **Home (Dashboard)** — Summary stat cards at top, recent notifications list below
3. **Patients** — Search bar at top, scrollable patient cards, floating add button
4. **Patient Detail/Edit** — Form to view/edit patient info (opens as a stack screen)
5. **Exercise Library** — Search bar + category filter, scrollable exercise cards, floating add button (permission-gated)
6. **Exercise Detail/Edit** — View/edit exercise fields, read-only for shared exercises, media status display
7. **Programs** — Patient selector, program list with cards, new/edit program form with exercise picker and dosage fields
8. **Marketplace Browse** — Grid of approved listings, search/filter/sort, detail modal with carousel and rent request
9. **My Listings** — Clinician's own listings with stats, new listing form
10. **Rental Logbook** — Two-tab view (My Rentals / My Listings rentals), actions: extend, cancel, review, dispute
11. **Settings** — Profile section, logout, about info with disclaimers and credits
12. **Admin Hub** — Grid of admin section cards (admin-only)
13. **Clinician Management** — Full CRUD with search, tier picker, permission overrides
14. **Notifications Management** — CRUD with type badges and delete confirmation
15. **Media Requests** — Approve/reject media requests with status updates
16. **User Feedback** — View/manage user feedback with status filter and admin notes
17. **Organisations** — CRUD (or placeholder if table missing)
18. **Shared Exercises** — Manage exercise-clinician sharing
19. **Assessments** — CRUD (or placeholder if table missing)
20. **Splash Ads** — Full CRUD with thumbnail preview, target type picker, date range, active toggle
21. **Knowledge Videos** — Full CRUD with YouTube/Vimeo preview, bilingual fields, tags, creator/provider info
22. **Feeding Skills** — Full CRUD for feeding skill videos with bilingual fields, tags, category
23. **Flower Garden** — Two-tab view: Flower Types CRUD (rarity, weight, image) + Patient Flowers read-only list
24. **Marketing Draws** — Two-tab view: Campaigns CRUD (triggers, date range) + Prizes CRUD (filtered by campaign)
25. **Reinforcement Audio** — Full CRUD for reinforcement audio library with multilingual YouTube IDs and audio URLs
26. **Therapist Settings** — Patient list with therapist name/photo per patient, edit modal for therapist_name_en/zh + photo/cartoon URLs
27. **Managing Org** — Default org config section + per-patient org override list with edit modal and bulk apply

---

## App Icon
- A clean, professional icon with a warm orange (#E07A3A) gradient background and a white medical/clinical symbol (stylized clipboard or pulse line), conveying healthcare technology
