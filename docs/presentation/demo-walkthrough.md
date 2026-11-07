# Demo school and screen-recording guide

## The demo academy
"Aqua Stars Swim Academy": 24 fictional swimmers in 4 age categories (8 and Under, Group IV 9 to 10, Group III 11 to 12, Group II 13 to 14), 44 sessions over 4 weeks, weekly Friday time trials (about 160 timings), one inter-club competition, skill ratings and coach notes. Full roster and numbers: [DEMO_SCHOOL.md](../../DEMO_SCHOOL.md). All names are fictional.

## Start it (development stack)
```bash
./run.sh
python3 seed_demo.py
```
The app is then at `http://localhost:8080`. The sign-in code (OTP) is shown on screen in this development mode, so recordings need no SMS. Do not use the production site for recordings.

## Demo logins (fictional, development stack only)
| Role | Phone |
|---|---|
| Head coach, Rajesh Menon | 9800000001 |
| Assistant coach, Divya Nair | 9800000002 |
| Super admin | 9999999999 |

Signing in ends the other device's session for the same user, so use the assistant login on a second device.

## Recording setup
- Record on a real phone or in a browser with device mode set to a phone (375 x 812) and device pixel ratio 3, then export at 1080 x 1920 or higher.
- Use the normal text size, light theme, and hide browser bars for a clean frame.
- Hide any notification that shows real information.

## Click path for the video (matches [video-script.md](video-script.md))
1. Sign in: enter 9800000002, tap Send OTP, type the code shown, tap Verify and Login.
2. Home: tap Morning Session (or Start Morning Session on a fresh day). Show attendance: tap two names to turn P into A; tap Save All.
3. Timings tab: choose FR and 50m. Type 30.10 for a swimmer who has a personal best of about 30.69 and press Enter. The personal best banner appears. (Pick a swimmer from Group II, such as Dev Malhotra.)
4. Students tab: scroll the cards, tap the green chat icon on one card (it opens WhatsApp or the browser).
5. Tap the trend icon for Dev Malhotra: show attendance rings and personal bests, scroll to Timing Trends and tap two chips to switch the chart, then scroll to Skill Ratings and Coach Notes (tap the stars, type a short note and tap Add Note).
6. Tap the avatar (top right): show Profile and the text-size setting.

## Compared stories for the deck
- **Dev Malhotra** (Group II): rich data, 5 star butterfly, many personal bests. Use for the "full picture" shot.
- **Aarav Mehta** (8 and Under): sparse data, 25 m only. Use to show it fits beginners.
