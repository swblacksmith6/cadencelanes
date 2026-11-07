# Conventions

## Adding a club-scoped endpoint

1. Put the route in the right `backend/routers/*.py`. Club routes live under `/api/club/{club_id}/...`.
2. Protect it: router-level `dependencies=[Depends(require_coach)]` (most routers), or add `require_head_coach` per route. Never leave a club route without one.
3. Get the DB with `db: Session = Depends(club_db)`. Use `get_control_db` only for platform data.
4. Use a Pydantic model in `backend/schemas/` for the body. Validation failures become 422 automatically.
5. Put logic beyond simple CRUD in `backend/services/`.
6. Raise `HTTPException(status_code, detail)` for expected failures. Do not catch and swallow database errors; the middleware classifies them.
7. Write a test in `backend/tests/` (see below). Update the feature doc.

## Status codes in use

200 success, 201 created, 400 rule broken (for example removing the head coach), 401 not logged in or account inactive,
403 wrong role or other club, 404 not found, 409 duplicate or state conflict, 422 validation, 429 OTP rate limit, 502 SMS provider failed.

## Logging

Use `get_logger("app.<area>")` and `log_event(log, logging.LEVEL, "event_name", key=value, ...)` from `backend/logging_config.py`.

- Event names are lowercase snake_case and stable (people grep for them).
- Failures include `error_code` and `hint` (what it means and how to fix it).
- Never log tokens, auth keys, OTPs (except the dev-only `otp_generated_dev`), or full phone numbers (use `phone_tail`).
- Do not use `print`. Do not log inside loops per row.

## Backend tests

- `backend/tests/conftest.py` sets an isolated temp `DATA_DIR` and dev settings before the app imports. Use the fixtures: `client`, `api`, `admin_token`, `club`, `other_club`, `reference`.
- `make_club(...)` creates a fresh approved club; `new_phone()` gives unique phones. Create a fresh phone for tests that request OTPs (limit is 5 per hour per phone).
- Mock outbound HTTP (MSG91) by patching `sms_service.urllib.request.urlopen`. Tests must never send real SMS.
- Assert logs through `caplog` records (`record.event`, `record.fields`).

## Frontend

- Pages in `src/pages`, shared pieces in `src/components`, one axios instance in `src/api/client.js`. Always call the API through it.
- Tests sit next to the file (`Foo.test.jsx`). `src/test/setup.js` provides an in-memory `localStorage`.
- Everything needs the internet. Do not add offline caching of API data or a write queue (see [decisions.md](decisions.md)).
- Styling is Tailwind utility classes. Icons from `lucide-react`.
- Theme is Tidepool, defined once in `frontend/src/index.css` under `@theme`. The classes keep Tailwind's names but the colours are remapped: `slate-*` are the sea-glass and forest neutrals, `sky-*` is the violet accent, `green/red/amber-*` are the status colours. Use those names; do not add hex colours in components (chart strokes are the exception: violet `#5b3fd6`, grid `#d6e4dd`).
- Fonts are Plus Jakarta Sans and DM Mono, bundled from `@fontsource` (no font host).
- Phone first: use `md:` to widen. Lists with many columns render as cards under `md` and as a table from `md` up. Use `px-safe`, `pt-safe`, `pb-safe` for fixed bars and `min-h-dvh` instead of `min-h-screen`.

## General

- No emojis anywhere (code, comments, docs, commit messages).
- Commit messages are 100 words or fewer, including trailers.
- Match the surrounding code style and comment density.
- Run `./run_tests.sh` before every commit; add or update a test with each behaviour change.
