# Logs and tests

## Reading the logs

Every line is logfmt: `<utc time> level=.. logger=.. request_id=.. event=.. key=value ...`

- One `event=request` line per HTTP request: method, path, status, duration_ms, user_id, club_id.
- Every problem line has `error_code=` and `hint=` saying what it means and how to fix it.
- Every response carries `X-Request-ID`. A client can send its own. Trace one request end to end with:

```bash
docker logs cadencelanes 2>&1 | grep request_id=<id>
```

| Want | Command |
|---|---|
| All problems | `docker logs cadencelanes 2>&1 \| grep -E 'level=(WARNING\|ERROR)'` |
| Server errors only | `... \| grep level=ERROR` |
| Slow requests | `... \| grep event=request \| awk -F'duration_ms=' '{split($2,a," "); if (a[1]>500) print}'` |
| Login problems | `... \| grep -E 'event=(otp_\|login_ok\|sms_)'` |
| SMS delivery | `... \| grep -E 'event=sms_'` |

Common `error_code` values: `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_FAILED`,
`RATE_LIMITED`, `SMS_REJECTED`, `SMS_NETWORK_ERROR`, `DB_LOCKED`, `DB_SCHEMA_MISMATCH`, `DB_FILE_ACCESS`,
`UNHANDLED_EXCEPTION`. A 500 response body contains the `request_id` to search for.

Set `LOG_LEVEL=DEBUG` in `.env` for more detail. Secrets (auth keys, tokens) are never logged; the OTP is
logged only in dev when no SMS provider is configured.

## Tests

```bash
./run_tests.sh              # backend pytest + frontend vitest + frontend production build
./run_tests.sh backend      # backend only
./run_tests.sh frontend     # frontend only
./run_tests.sh backend -k login   # extra args go to pytest / vitest
```

- Backend tests: `backend/tests` (pytest, isolated temp database, SMS mocked). The script creates `backend/.venv` itself.
- Frontend tests: `*.test.js(x)` next to the code (vitest + Testing Library).
- No git hook and no CI: tests are run manually (in the Claude session) before every commit.
- Rule: a new feature or fix adds a test, and the whole suite must pass before committing.
