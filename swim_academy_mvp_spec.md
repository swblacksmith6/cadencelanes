# SwimAcademy — MVP Specification for One-Shot Build

**Version:** 1.0
**Date:** 2026-08-04
**Purpose:** Complete specification to build the entire MVP in a single pass. Every endpoint, every page, every schema is defined. No ambiguity.

---

## 1. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend | FastAPI | latest |
| ORM | SQLAlchemy | 2.x (use DeclarativeBase) |
| Database | SQLite | via SQLAlchemy |
| Auth | JWT (python-jose) + phone OTP | - |
| Validation | Pydantic v2 | - |
| Frontend | React (Vite) | latest |
| Styling | Tailwind CSS | latest |
| Routing | React Router v6 | latest |
| HTTP Client | Axios | latest |
| Charts | Recharts | latest |
| State | React Context + hooks | - |
| Icons | Lucide React | latest |

---

## 2. Project Structure

```
swim-academy/
├── backend/
│   ├── main.py                         # FastAPI app, CORS, startup events
│   ├── requirements.txt
│   ├── config.py                       # Settings, JWT secret, OTP expiry
│   ├── db/
│   │   ├── __init__.py
│   │   ├── engine.py                   # Engine factory, session deps, create_club_database()
│   │   ├── control_models.py           # Club, User, OTPCode, AdminAuditLog
│   │   └── club_models.py             # Coach, Student, ParentContact, SwimStyle,
│   │                                   # DistanceEvent, Session, Attendance, Timing,
│   │                                   # PersonalBest, CoachNote, SkillAssessment
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py                     # OTP request/verify, JWT token response
│   │   ├── club.py                     # Club register, club response, club admin CRUD
│   │   ├── coach.py                    # Coach create/response
│   │   ├── student.py                  # Student create/update/response with parent contacts
│   │   ├── session.py                  # Session create/response
│   │   ├── attendance.py               # Attendance update/response
│   │   ├── timing.py                   # Timing create/response
│   │   └── progress.py                # Progress report response schema
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py                     # /auth/*
│   │   ├── admin.py                    # /admin/*
│   │   ├── coaches.py                  # /club/{club_id}/coaches/*
│   │   ├── students.py                 # /club/{club_id}/students/*
│   │   ├── sessions.py                 # /club/{club_id}/sessions/*
│   │   ├── timings.py                  # /club/{club_id}/timings/*
│   │   └── progress.py                # /club/{club_id}/students/{id}/progress
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py             # OTP generation, verification, JWT creation
│   │   ├── club_service.py             # Club registration, approval workflow
│   │   ├── session_service.py          # Session creation with auto-attendance
│   │   ├── timing_service.py           # Timing recording with PB auto-update
│   │   └── progress_service.py        # Progress report computation
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── auth.py                     # JWT decode, role checking, get_current_user
│   └── data/                           # Created at runtime
│       ├── control.db
│       └── clubs/
│           └── club_{id}.db
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                     # Router setup
│       ├── api/
│       │   └── client.js               # Axios instance with JWT interceptor
│       ├── context/
│       │   └── AuthContext.jsx          # Auth state, login/logout, user info
│       ├── hooks/
│       │   └── useApi.js               # Generic fetch hook with loading/error
│       ├── components/
│       │   ├── Layout.jsx              # Sidebar + top bar shell
│       │   ├── ProtectedRoute.jsx      # Redirect if not authed
│       │   ├── RoleGuard.jsx           # Show/hide based on role
│       │   └── LoadingSpinner.jsx
│       └── pages/
│           ├── Home.jsx                # Landing: Login | Register Club
│           ├── Login.jsx               # Phone → OTP → Dashboard
│           ├── RegisterClub.jsx        # Club registration form
│           ├── Dashboard.jsx           # Student list + quick actions
│           ├── StudentForm.jsx         # Add/edit student + parent contacts
│           ├── StudentList.jsx         # Table of all students
│           ├── CoachList.jsx           # Manage assistant coaches
│           ├── CoachForm.jsx           # Add assistant coach
│           ├── SessionList.jsx         # List sessions by date
│           ├── SessionCreate.jsx       # Create morning/evening session
│           ├── AttendanceView.jsx      # Mark attendance for a session
│           ├── TimingEntry.jsx         # Record times per student
│           ├── TimingHistory.jsx       # View timing history for a student
│           ├── ProgressReport.jsx      # Full progress view for a student
│           ├── AdminDashboard.jsx      # Super admin: club list
│           └── AdminClubDetail.jsx     # Approve/reject/delete club
```

---

## 3. Database Schema

**Use the locked schema from `swim_academy_database_design_v3_sqlalchemy.md`.**

Summary:
- **control.db** (4 tables): clubs, users, otp_codes, admin_audit_log
- **club_{id}.db** (10 tables): coaches, students, parent_contacts, swim_styles, distance_events, sessions, attendance, timings, personal_bests, coach_notes, skill_assessments

Refer to that document for complete SQLAlchemy model code, engine factory, and seed data.

---

## 4. Authentication Flow

### 4.1 OTP Request
```
POST /auth/request-otp
Body: { "phone": "9876543210" }

Logic:
1. Check if phone exists in users table
2. If not found → return 404 "Phone not registered"
3. Generate random 6-digit code
4. Store in otp_codes with expires_at = now + 5 minutes
5. Return { "message": "OTP sent", "otp": "123456" }
   ↑ MVP only: return OTP in response (no real SMS)
   Production: remove otp from response, send via SMS
```

### 4.2 OTP Verify
```
POST /auth/verify-otp
Body: { "phone": "9876543210", "code": "123456" }

Logic:
1. Find latest unused OTP for this phone where expires_at > now
2. If not found or code doesn't match → 401
3. Mark OTP as used
4. Look up user by phone
5. Generate JWT with payload:
   {
     "user_id": "uuid",
     "phone": "9876543210",
     "role": "head_coach",
     "club_id": "uuid-of-club",   // null for super_admin
     "name": "Coach Name"
   }
6. Return { "access_token": "jwt...", "user": { id, name, role, club_id } }
```

### 4.3 JWT Structure
```
Secret: from config.py (env var JWT_SECRET, default "swim-academy-secret-key-change-in-prod")
Algorithm: HS256
Expiry: 24 hours
```

### 4.4 Auth Middleware
```python
# Every protected route uses: current_user = Depends(get_current_user)
# get_current_user decodes JWT, returns user dict
# Role-specific deps:
#   require_head_coach → checks role == "head_coach"
#   require_coach → checks role in ["head_coach", "assistant_coach"]
#   require_admin → checks role == "super_admin"
# All club routes also verify club_id from JWT matches URL param
```

### 4.5 Super Admin
- Hardcoded seed: phone `9999999999`, role `super_admin`
- Created on first app startup if not exists

---

## 5. API Endpoints — Complete Specification

### 5.1 Auth Routes (`/auth`)

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/auth/request-otp` | None | `{ phone }` | `{ message, otp }` | otp only in MVP |
| POST | `/auth/verify-otp` | None | `{ phone, code }` | `{ access_token, user }` | |

### 5.2 Club Registration (`/register-club`)

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/register-club` | None | `{ name, head_coach_name, head_coach_phone }` | `{ message, club_id }` | Status = pending |

**Business logic:**
- Validate phone not already registered (as club head or user)
- Insert club with status=pending
- Log: "In production, email sent to super admin" (stub for MVP)

### 5.3 Admin Routes (`/admin`) — requires super_admin role

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | `/admin/clubs` | - | `[{ id, name, head_coach_name, head_coach_phone, status, created_at }]` | List all clubs |
| GET | `/admin/clubs?status=pending` | - | Filtered list | Filter by status |
| GET | `/admin/clubs/{club_id}` | - | Club detail | |
| POST | `/admin/clubs/{club_id}/approve` | - | `{ message }` | Creates club DB, seeds data, creates User + Coach |
| POST | `/admin/clubs/{club_id}/reject` | `{ reason }` | `{ message }` | Sets rejection_reason |
| DELETE | `/admin/clubs/{club_id}` | - | `{ message }` | Deletes club DB file + club + users from control |
| GET | `/admin/users` | - | `[{ id, name, phone, role, club_id }]` | All users |

**Approve logic (critical):**
1. Update club status to "approved", set approved_at
2. Call `create_club_database(club_id)` → creates SQLite file + all 10 tables
3. Seed default swim styles (5) and distance events (7)
4. Create User in control.db (phone=head_coach_phone, role=head_coach, club_id=club_id)
5. Create Coach in club DB (user_id=new_user.id, role=head_coach)
6. Log action in admin_audit_log

### 5.4 Coach Routes (`/club/{club_id}/coaches`)

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/club/{cid}/coaches` | coach | - | `[{ id, name, phone, role, is_active }]` | |
| POST | `/club/{cid}/coaches` | head_coach only | `{ name, phone }` | `{ id, name, phone, role }` | Creates User + Coach |
| PUT | `/club/{cid}/coaches/{id}` | head_coach | `{ name, is_active }` | Updated coach | Deactivate/update |
| DELETE | `/club/{cid}/coaches/{id}` | head_coach | - | `{ message }` | Soft delete (is_active=false) |

**Add assistant coach logic:**
1. Validate phone not already a user
2. Create User in control.db (role=assistant_coach, club_id=club_id)
3. Create Coach in club DB (user_id=new_user.id, role=assistant_coach)

### 5.5 Student Routes (`/club/{club_id}/students`)

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/club/{cid}/students` | coach | - | `[{ id, name, date_of_birth, is_active, parent_contacts }]` | Active only by default |
| GET | `/club/{cid}/students?include_inactive=true` | coach | - | All students | |
| GET | `/club/{cid}/students/{id}` | coach | - | Full student detail with contacts | |
| POST | `/club/{cid}/students` | coach | StudentCreate | `{ id, name, ... }` | |
| PUT | `/club/{cid}/students/{id}` | coach | StudentUpdate | Updated student | |
| DELETE | `/club/{cid}/students/{id}` | coach | - | `{ message }` | Soft delete |

**StudentCreate schema:**
```json
{
  "name": "Ravi Kumar",                    // required
  "date_of_birth": "2015-06-15",           // required, YYYY-MM-DD
  "address": "123 Main St, Chennai",       // optional
  "parent_contacts": [                     // required, 1-2 items
    {
      "relation": "father",               // father | mother | guardian
      "name": "Suresh Kumar",             // optional
      "phone": "9876543210",              // required
      "is_primary": true                  // exactly one must be true
    },
    {
      "relation": "mother",               // optional second contact
      "name": "Priya Kumar",
      "phone": "9876543211",
      "is_primary": false
    }
  ]
}
```

**Validation rules:**
- name: required, min 1 char
- date_of_birth: required, must be in the past
- parent_contacts: 1-2 items, exactly one is_primary=true
- relation: must be "father", "mother", or "guardian"
- phone in parent_contacts: required

### 5.6 Session Routes (`/club/{club_id}/sessions`)

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/club/{cid}/sessions` | coach | - | `[{ id, session_date, session_type, notes, created_by_name }]` | Last 30 days default |
| GET | `/club/{cid}/sessions?from=2026-07-01&to=2026-07-31` | coach | - | Filtered | |
| GET | `/club/{cid}/sessions/{id}` | coach | - | Session with attendance list | |
| POST | `/club/{cid}/sessions` | coach | `{ session_date, session_type, notes? }` | Session + attendance | Auto-creates attendance |
| DELETE | `/club/{cid}/sessions/{id}` | head_coach | - | `{ message }` | Cascades to attendance + timings |

**Session create logic:**
1. Validate no existing session for (date, type) — UniqueConstraint handles this
2. Insert Session
3. Query all active students
4. Bulk insert Attendance for each student with status="present"
5. Return session with attendance list

### 5.7 Attendance Routes (`/club/{club_id}/sessions/{session_id}/attendance`)

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| GET | `/club/{cid}/sessions/{sid}/attendance` | coach | - | `[{ student_id, student_name, status }]` | |
| PUT | `/club/{cid}/sessions/{sid}/attendance` | coach | `{ updates: [{ student_id, status }] }` | `{ message, updated_count }` | Batch update |

**Attendance update schema:**
```json
{
  "updates": [
    { "student_id": "uuid-1", "status": "absent" },
    { "student_id": "uuid-2", "status": "present" }
  ]
}
```

### 5.8 Timing Routes (`/club/{club_id}/timings`)

| Method | Path | Auth | Body | Response | Notes |
|---|---|---|---|---|---|
| POST | `/club/{cid}/timings` | coach | TimingCreate | Timing + PB update info | |
| GET | `/club/{cid}/timings?student_id=X&style_id=Y&distance_id=Z` | coach | - | `[{ id, session_date, time_seconds, style, distance }]` | Filtered timing history |
| GET | `/club/{cid}/timings/session/{session_id}` | coach | - | All timings for a session | |
| PUT | `/club/{cid}/timings/{id}` | coach | `{ time_seconds, notes }` | Updated timing | |
| DELETE | `/club/{cid}/timings/{id}` | coach | - | `{ message }` | |

**TimingCreate schema:**
```json
{
  "session_id": "uuid",
  "student_id": "uuid",
  "swim_style_id": "uuid",
  "distance_event_id": "uuid",
  "time_seconds": 32.45,
  "notes": "Good form on turns"        // optional
}
```

**Recording logic:**
1. Insert Timing
2. Query PersonalBest for (student, style, distance)
3. If no PB exists → create one
4. If new time < existing PB → update PB, store previous_best
5. Return timing + `{ is_new_pb: true/false, improvement: 1.65 }`

### 5.9 Reference Data Routes

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/club/{cid}/swim-styles` | coach | - | `[{ id, name, short_code }]` |
| GET | `/club/{cid}/distance-events` | coach | - | `[{ id, distance_meters, label }]` |

### 5.10 Coach Notes Routes (`/club/{club_id}/students/{student_id}/notes`)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/club/{cid}/students/{sid}/notes` | coach | - | `[{ id, note, category, coach_name, created_at }]` |
| POST | `/club/{cid}/students/{sid}/notes` | coach | `{ note, category? }` | Created note |

Category options: `general`, `technique`, `fitness`, `behavior`, `goal`. Default: `general`.

### 5.11 Skill Assessment Routes (`/club/{club_id}/students/{student_id}/assessments`)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/club/{cid}/students/{sid}/assessments` | coach | - | `[{ id, swim_style, rating, notes, assessed_by, assessed_at }]` |
| POST | `/club/{cid}/students/{sid}/assessments` | coach | `{ swim_style_id, rating, notes? }` | Created assessment |

Rating: integer 1-5. Labels: 1=Beginner, 2=Elementary, 3=Intermediate, 4=Advanced, 5=Elite.

### 5.12 Progress Report Route

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/club/{cid}/students/{sid}/progress?from_date=X&to_date=Y` | coach | Full progress JSON |

**Response schema:**
```json
{
  "student": {
    "id": "uuid",
    "name": "Ravi Kumar",
    "age": 11,
    "date_of_birth": "2015-06-15",
    "enrolled_since": "2026-01-15"
  },
  "attendance": {
    "last_7_days":  { "total": 10, "attended": 9, "percentage": 90.0 },
    "last_30_days": { "total": 45, "attended": 40, "percentage": 88.9 },
    "all_time":     { "total": 200, "attended": 180, "percentage": 90.0 },
    "current_streak": 12
  },
  "personal_bests": [
    {
      "style": "Freestyle",
      "style_short": "FR",
      "distance": "50m",
      "best_time": 32.45,
      "previous_best": 34.10,
      "improvement": 1.65,
      "achieved_at": "2026-07-28"
    }
  ],
  "timing_trends": {
    "FR_50m": {
      "label": "Freestyle 50m",
      "data": [
        { "date": "2026-06-01", "time": 38.2, "session_type": "morning" },
        { "date": "2026-06-15", "time": 36.8, "session_type": "evening" }
      ]
    }
  },
  "skill_ratings": {
    "Freestyle":    { "current": 3, "label": "Intermediate", "history": [{ "date": "...", "rating": 2 }, { "date": "...", "rating": 3 }] },
    "Backstroke":   { "current": 2, "label": "Elementary",   "history": [...] }
  },
  "recent_notes": [
    {
      "date": "2026-07-25",
      "coach": "John",
      "category": "technique",
      "note": "Breathing rhythm improving on freestyle"
    }
  ]
}
```

**Computation logic (progress_service.py):**
1. Attendance: query attendance + sessions, group by date ranges, count present/total
2. Streak: walk backwards from today counting consecutive present
3. Personal bests: direct read from personal_bests table, join swim_styles + distance_events
4. Timing trends: query timings ordered by session_date, group by (style, distance)
5. Skill ratings: query skill_assessments ordered by assessed_at, group by style, latest = current
6. Notes: query coach_notes ordered by created_at DESC, limit 20

---

## 6. Role-Based Access Control Matrix

| Action | Super Admin | Head Coach | Assistant Coach |
|---|---|---|---|
| Approve/reject clubs | ✅ | ❌ | ❌ |
| CRUD clubs | ✅ | ❌ | ❌ |
| View all users | ✅ | ❌ | ❌ |
| Add assistant coaches | ❌ | ✅ | ❌ |
| Remove/deactivate coaches | ❌ | ✅ | ❌ |
| Add/edit/remove students | ❌ | ✅ | ✅ |
| Create sessions | ❌ | ✅ | ✅ |
| Mark attendance | ❌ | ✅ | ✅ |
| Record timings | ❌ | ✅ | ✅ |
| Add coach notes | ❌ | ✅ | ✅ |
| Add skill assessments | ❌ | ✅ | ✅ |
| View progress reports | ❌ | ✅ | ✅ |
| Manage swim styles | ❌ | ✅ | ❌ |
| Delete sessions | ❌ | ✅ | ❌ |

---

## 7. Frontend Pages — Complete Specification

### 7.1 Home Page (`/`)
- Two centered buttons: **Login** and **Register Club**
- Clean, minimal landing with app name "SwimAcademy" and tagline
- If already logged in (JWT in localStorage), redirect to Dashboard

### 7.2 Register Club (`/register`)
- Form fields:
  - Club Name (text, required)
  - Head Coach Name (text, required)
  - Head Coach Phone (tel, required, 10 digits)
- Submit → POST `/register-club`
- On success: show "Registration submitted! You'll be notified once approved."
- On error (phone exists): show inline error

### 7.3 Login (`/login`)
- **Step 1:** Phone number input + "Send OTP" button
  - POST `/auth/request-otp`
  - On success → show Step 2
  - MVP: show the returned OTP in a toast/alert for easy testing
- **Step 2:** 6-digit OTP input + "Verify" button
  - POST `/auth/verify-otp`
  - On success → store JWT + user in AuthContext + localStorage → redirect:
    - super_admin → `/admin`
    - head_coach or assistant_coach → `/dashboard`

### 7.4 Dashboard (`/dashboard`)
- **Top bar:** Club name, coach name, logout button
- **Quick stats cards:**
  - Total active students
  - Today's sessions (created or not)
  - This week's attendance %
- **Quick action buttons:**
  - Create Morning Session / Create Evening Session (only if not already created today)
  - Add Student
- **Student list preview** (first 10, link to full list)
- **Sidebar nav:** Dashboard, Students, Coaches (head_coach only), Sessions, Timings

### 7.5 Student List (`/students`)
- Table: Name, Age, DOB, Primary Contact, Status (active badge)
- Search bar (filter by name)
- "Add Student" button
- Click row → Student detail page
- Each row has a "Progress" button → `/students/{id}/progress`

### 7.6 Student Form (`/students/new` and `/students/{id}/edit`)
- **Student section:**
  - Name (text, required)
  - Date of Birth (date picker, required)
  - Address (textarea, optional)
- **Parent Contact 1 (Primary — required):**
  - Relation (dropdown: Father / Mother / Guardian)
  - Name (text, optional)
  - Phone (tel, required)
  - "Primary" badge (always on for first)
- **Parent Contact 2 (Optional):**
  - Toggle: "Add second contact"
  - Same fields as above
  - Cannot be primary if contact 1 exists
- Submit → POST or PUT
- Validation: name required, DOB required and in past, at least 1 contact with phone

### 7.7 Coach List (`/coaches`) — head_coach only
- Table: Name, Phone, Role, Status
- "Add Assistant Coach" button
- Toggle active/inactive per coach

### 7.8 Coach Form (`/coaches/new`) — head_coach only
- Fields: Name (required), Phone (required, 10 digits)
- Submit → POST `/club/{cid}/coaches`
- Role is always "assistant_coach" (auto-set)

### 7.9 Session List (`/sessions`)
- Date picker at top to navigate to a specific date
- Default: today
- Shows morning and evening cards for selected date
- Each card shows:
  - Status: Created / Not Created
  - If created: student count, present count, absent count
  - "Create" button if not created, "View Attendance" if created
- Navigate between days with ← → arrows

### 7.10 Session Create (`/sessions/new`)
- Select date (default today) and type (morning/evening)
- Optional notes field
- Submit → creates session + auto-generates attendance
- Redirect to attendance view

### 7.11 Attendance View (`/sessions/{id}/attendance`)
- Session header: date, type, coach who created
- Student list with toggle switches (present ✅ / absent ❌)
- All default to present
- Coach toggles absences
- Auto-saves on each toggle (PUT request) or "Save All" button for batch
- Summary bar: X present, Y absent out of Z total

### 7.12 Timing Entry (`/timings/entry`)
- **Step 1:** Select session (dropdown of recent sessions)
- **Step 2:** Select student (dropdown of students who attended that session)
- **Step 3:** Select swim style (dropdown) + distance (dropdown)
- **Step 4:** Enter time in seconds (number input, allows decimals like 32.45)
- **Step 5:** Optional notes
- Submit → POST `/club/{cid}/timings`
- On success: show if it's a new PB with improvement amount 🎉
- "Add Another" button to quickly record next timing without re-selecting session
- Also allow a bulk entry view: table with rows for each present student, columns for time input per style+distance

### 7.13 Timing History (`/students/{id}/timings`)
- Filter by swim style and distance
- Table: Date, Session, Style, Distance, Time, PB badge
- Line chart (Recharts) showing time trend for selected style+distance

### 7.14 Progress Report (`/students/{id}/progress`)
- **Student header:** Name, age, enrolled since
- **Attendance card:** percentage ring charts for 7d/30d/all-time, streak count
- **Personal bests table:** style, distance, best time, improvement from previous
- **Timing trends:** line charts per style+distance (Recharts), selectable via tabs or dropdown
- **Skill ratings:** current ratings with 1-5 stars per style, or a radar chart
- **Coach notes:** chronological feed, category color badges
- **Print/export button:** opens browser print dialog (CSS @media print)

### 7.15 Admin Dashboard (`/admin`) — super_admin only
- **Tabs:** Pending | Approved | Rejected | All
- Table: Club Name, Head Coach, Phone, Status, Date, Actions
- **Pending actions:** Approve / Reject buttons
- **Reject:** opens modal for reason input
- **Approved actions:** View detail, Delete
- **Click row:** opens detail view

### 7.16 Admin Club Detail (`/admin/clubs/{id}`)
- Club info (name, coach, phone, dates)
- Status with action buttons
- List of users in this club (head coach + assistants)

---

## 8. Frontend Routes

```jsx
<Routes>
  {/* Public */}
  <Route path="/" element={<Home />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<RegisterClub />} />

  {/* Coach (head + assistant) */}
  <Route element={<ProtectedRoute roles={["head_coach", "assistant_coach"]} />}>
    <Route element={<Layout />}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/students" element={<StudentList />} />
      <Route path="/students/new" element={<StudentForm />} />
      <Route path="/students/:id/edit" element={<StudentForm />} />
      <Route path="/students/:id/progress" element={<ProgressReport />} />
      <Route path="/students/:id/timings" element={<TimingHistory />} />
      <Route path="/sessions" element={<SessionList />} />
      <Route path="/sessions/new" element={<SessionCreate />} />
      <Route path="/sessions/:id/attendance" element={<AttendanceView />} />
      <Route path="/timings/entry" element={<TimingEntry />} />
    </Route>
  </Route>

  {/* Head Coach Only */}
  <Route element={<ProtectedRoute roles={["head_coach"]} />}>
    <Route element={<Layout />}>
      <Route path="/coaches" element={<CoachList />} />
      <Route path="/coaches/new" element={<CoachForm />} />
    </Route>
  </Route>

  {/* Super Admin */}
  <Route element={<ProtectedRoute roles={["super_admin"]} />}>
    <Route path="/admin" element={<AdminDashboard />} />
    <Route path="/admin/clubs/:id" element={<AdminClubDetail />} />
  </Route>
</Routes>
```

---

## 9. API Client Setup (Frontend)

```javascript
// src/api/client.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',  // Vite proxy to FastAPI in dev
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
```

---

## 10. Backend Configuration

```python
# config.py
import os

class Settings:
    JWT_SECRET: str = os.getenv("JWT_SECRET", "swim-academy-secret-key-change-in-prod")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    OTP_EXPIRY_MINUTES: int = 5
    OTP_LENGTH: int = 6
    DATA_DIR: str = "data"
    SUPER_ADMIN_PHONE: str = "9999999999"
    SUPER_ADMIN_NAME: str = "Super Admin"

settings = Settings()
```

---

## 11. FastAPI App Setup

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from db.engine import control_engine, create_club_database
from db.control_models import ControlBase, User
from routers import auth, admin, coaches, students, sessions, timings, progress

app = FastAPI(title="SwimAcademy API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth.router,     prefix="/api/auth",     tags=["Auth"])
app.include_router(admin.router,    prefix="/api/admin",    tags=["Admin"])
app.include_router(coaches.router,  prefix="/api/club/{club_id}/coaches",   tags=["Coaches"])
app.include_router(students.router, prefix="/api/club/{club_id}/students",  tags=["Students"])
app.include_router(sessions.router, prefix="/api/club/{club_id}/sessions",  tags=["Sessions"])
app.include_router(timings.router,  prefix="/api/club/{club_id}/timings",   tags=["Timings"])
app.include_router(progress.router, prefix="/api/club/{club_id}/students",  tags=["Progress"])

# Register club (public)
app.include_router(auth.register_router, prefix="/api", tags=["Registration"])

@app.on_event("startup")
def startup():
    """Create control DB tables and seed super admin."""
    ControlBase.metadata.create_all(bind=control_engine)
    # Seed super admin if not exists
    from db.engine import ControlSessionLocal
    from config import settings
    db = ControlSessionLocal()
    existing = db.query(User).filter_by(phone=settings.SUPER_ADMIN_PHONE).first()
    if not existing:
        admin_user = User(
            phone=settings.SUPER_ADMIN_PHONE,
            name=settings.SUPER_ADMIN_NAME,
            role="super_admin",
            club_id=None,
        )
        db.add(admin_user)
        db.commit()
    db.close()

# In production: mount built React app
# app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

---

## 12. Error Response Format

All API errors follow this structure:
```json
{
  "detail": "Human readable error message"
}
```

Standard HTTP status codes:
- 200: Success
- 201: Created
- 400: Validation error / bad request
- 401: Not authenticated
- 403: Not authorized (wrong role)
- 404: Not found
- 409: Conflict (duplicate phone, session already exists)
- 500: Server error

---

## 13. Development & Run Commands

```bash
# Backend
cd backend
pip install fastapi uvicorn sqlalchemy python-jose[cryptography] pydantic
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm create vite@latest . -- --template react
npm install axios react-router-dom recharts lucide-react
npm install -D tailwindcss @tailwindcss/vite
npm run dev   # runs on port 5173, proxy to 8000
```

**Vite proxy config:**
```javascript
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
```

---

## 14. Key Implementation Notes

1. **Two-database pattern:** Every club-scoped route needs `club_id` from the URL AND must validate it matches the JWT's `club_id`. The club DB session is obtained via `get_club_db(club_id)` dependency.

2. **Session auto-attendance:** When POST `/sessions` is called, the service must query all active students and bulk-insert Attendance rows. This is the most important transactional operation.

3. **PB auto-update:** On every POST `/timings`, the service must check and potentially update PersonalBest. See pseudocode in the DB design doc section 10.

4. **Soft deletes everywhere:** Students and coaches are never hard-deleted. Set `is_active=False`. Inactive students should NOT get attendance rows when new sessions are created.

5. **No real SMS in MVP:** The OTP is returned in the API response. The frontend should display it in a toast for easy testing.

6. **No real email in MVP:** Club registration "notification" is just a log message. Super admin checks the pending list manually.

7. **Frontend auth flow:** JWT stored in localStorage. AuthContext provides `user`, `login()`, `logout()`. ProtectedRoute checks AuthContext and redirects to `/login` if no user.

8. **Progress report is read-only and computed:** No writes happen on the progress endpoint. It aggregates from attendance, timings, personal_bests, skill_assessments, and coach_notes.

9. **Date handling:** Backend stores dates as YYYY-MM-DD strings (Date columns). Frontend sends and receives ISO date strings. All timezone handling is ignored in MVP (assume local time).

10. **club_id in URL vs JWT:** Every club-scoped request has `club_id` in the URL path. The auth middleware MUST verify that the JWT's `club_id` matches. Super admin can access any club.

---

## 15. MVP Scope Boundary

### IN scope:
- Phone + OTP auth (stubbed)
- Club registration + admin approval workflow
- Coach management (head adds assistants)
- Student CRUD with parent contacts
- Session creation (morning/evening) with auto-attendance
- Attendance marking (toggle present/absent)
- Timing entry with PB tracking
- Coach notes and skill assessments
- Progress report with charts
- Super admin panel

### OUT of scope (future):
- Real SMS/OTP delivery
- Real email notifications
- Student photos
- Multiple clubs per coach
- Parent login portal
- Batch/group management
- Fee tracking
- Competition events
- Data export/import
- Mobile app (React Native)

---

*This document contains everything needed to build the complete MVP. The database schema is in the companion document `swim_academy_database_design_v3_sqlalchemy.md`. Both documents together form the full specification.*
