# Product brief: Cadence Lanes

## One sentence
Cadence Lanes is a phone-first app that lets swim coaches take attendance, record race times and see every swimmer's progress at the pool, in a few taps.

Tagline already used in the app: **Track every lap. Grow every swimmer.**

## Who it is for
- **Primary user:** swim coaches at a club or academy, head coach and assistant coaches. They stand on the pool deck with a phone, often with wet hands, and have a few seconds between sets.
- **Buyer:** the head coach or the owner of a swim academy.
- **Not a user:** parents and swimmers do not log in. The app helps coaches talk to parents (call, WhatsApp, text from the student list).
- **Market context in the product:** age groups follow Indian swimming categories (8 and Under, Group IV 9 to 10, Group III 11 to 12, Group II 13 to 14); phone numbers are Indian by default (WhatsApp links add the 91 country code); login is by phone number and SMS code.

## The problem
- Attendance is on paper or in chat groups, so nobody can say how often a swimmer actually trains.
- Times are scribbled on a whiteboard or a notebook. Personal bests are remembered, not recorded.
- Progress talks with parents rely on memory.
- Spreadsheets do not work on a pool deck.

## What the product does today
1. **Sessions and attendance.** Start the morning or evening session in one tap. Everyone is marked present; the coach taps only the exceptions (A). Competition and other custom session types are supported. One session per type per day.
2. **Record timings.** Pick a stroke (Freestyle, Backstroke, Breaststroke, Butterfly, Individual Medley) and a distance (25 m to 1500 m) once, then type a time for each swimmer and press Enter. The app tells the coach at once when a time is a new personal best and by how much it improved.
3. **Personal bests, kept correct.** Edit or delete a time and the personal best is recalculated from the remaining times.
4. **Student roster.** Exact age (years, months, days) for age-group placement, up to two parent contacts, coach notes (technique, fitness, behaviour, goal, general), skill ratings from 1 Beginner to 5 Elite per stroke.
5. **Contact parents.** From the student card: call, WhatsApp or text the primary parent contact.
6. **Progress report per swimmer.** Attendance for the last 7 days, 30 days and all time, session streak, personal bests, a timing trend chart per stroke and distance (each showing the personal best), skill ratings and recent notes. Print it.
7. **Multi-club.** Each club has its own private database. A super admin approves new clubs or adds a club and head coach directly.
8. **Head coach and assistants.** The head coach adds and deactivates assistant coaches. A deactivated coach loses access immediately.
9. **Installable.** It is a PWA: coaches add it to the phone home screen and it opens like an app.
10. **Secure sign-in.** Phone number plus a 6-digit SMS code (MSG91). Sessions last 30 days. Signing in on a new device ends the session on the old one.

## What it does not do (say this honestly)
- It needs the internet. There is no offline mode, by design, so data is never out of sync. Offline the app shows a clear "You are offline" screen.
- Parents and swimmers do not have logins or a parent app.
- No payments, fee tracking, scheduling or messaging inside the app (calls, WhatsApp and SMS open the phone's own apps).
- Meet management, race entries and rankings are not included.
- Light theme only for now.

## Differentiators
- Built for the pool deck: big targets, one-handed, an "everyone present" default so a session takes seconds.
- Instant personal-best feedback while the swimmer is still at the wall.
- Exact age by day, because age-group cut-offs matter.
- Each club's data lives in its own database file (data separation per club).
- Simple on purpose: four tabs (Home, Sessions, Timings, Students) and a profile.

## Proof points available now (from the demo school, not real customers)
Demo academy "Aqua Stars Swim Academy": 24 swimmers in 4 age categories, 4 weeks of sessions (44 sessions), weekly Friday time trials (about 160 timings), one inter-club competition. These are demo data and must be labelled as a demo in any slide or video.

## Technology (for a technical slide only)
React and Vite progressive web app, FastAPI backend, SQLite (one database per club), Docker, HTTPS behind a Caddy proxy.
