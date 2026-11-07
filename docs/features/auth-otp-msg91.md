# Authentication: OTP login with MSG91

## Purpose
Phone-number login with a one-time password sent by SMS. No passwords. A login lasts 30 days.

## Behaviour
1. `POST /api/auth/request-otp {phone}`: the phone must belong to an active user, else 404. A 6-digit code (from `secrets`) is stored in `otp_codes`, valid 5 minutes.
2. At most 5 OTP requests per phone per hour, else 429.
3. If `MSG91_AUTH_KEY` and `MSG91_OTP_TEMPLATE_ID` are set, the code is sent by SMS; if MSG91 fails the response is 502 and no code is revealed.
   If they are not set (dev only) the code is logged as `otp_generated_dev`.
4. The code is returned in the response only when `OTP_IN_RESPONSE=true` (dev only; startup refuses it elsewhere).
5. `POST /api/auth/verify-otp {phone, code}`: uses the newest unused, unexpired code. 5 wrong attempts burn the code. Success marks it used and returns `{access_token, other_sessions_ended, user}`.
6. The JWT carries `sid, user_id, phone, role, club_id, name, exp` and lasts `JWT_EXPIRY_DAYS` (30). It is a fixed lifetime, not extended by use.
7. One session per user. Each login stores a new `sid` in `active_sessions` (one row per user, in control.db) and puts it in the token.
   A token whose `sid` is not the stored one gets 401 with detail `SESSION_REPLACED`; a token with no `sid` (issued before this
   rule) or no stored session gets the ordinary 401, so everyone signs in once after the deploy. `other_sessions_ended` is true when
   the login replaced an older session.
8. On every request the user is looked up in control.db; an inactive or missing user gets 401 immediately, so deactivating a coach takes effect at once.
   Role and club inside the token are fixed until the next login.

## SMS template (MSG91 Flow API, DLT approved)
```
##code## is your One-Time Password (OTP) to log in to your ##name## account. This OTP is valid for ##min## minutes. Do not share it. -BRT International
```
`POST https://control.msg91.com/api/v5/flow`, header `authkey`, body `{template_id, short_url: "0", recipients: [{mobiles: "91<phone>", code, name, min}]}`.
`name` is `SMS_APP_NAME`, `min` is `OTP_EXPIRY_MINUTES`. The recipient keys must match the template variable names exactly.
MSG91 can answer HTTP 200 with `"type": "error"`, so the code checks the `type` field, not only the status.

## Where it lives
- Routes: `backend/routers/auth.py`. OTP and JWT logic: `backend/services/auth_service.py`. SMS: `backend/services/sms_service.py`.
- Token checks and roles: `backend/middleware/auth.py`.
- Frontend: `frontend/src/pages/Login.jsx`, `context/AuthContext.jsx`, `api/client.js` (401 logs out; `SESSION_REPLACED` also leaves a notice for the login page).
- Notice bar: `context/NoticeContext.jsx`. `useNotice().notify(text, 'info'|'success'|'error'|'warn')` shows one message for 10 seconds (dismissable; a newer one replaces it). Info is blue, success green, error red, warn amber. `<NoticeBar />` is the only place messages appear: a strip that takes no space until a message comes, then overlays the top of the page just under the top bar, and `<NoticeBar floating />` at the top of pages without the layout (login, register, admin). Pages send their `error` state to it with `useErrorNotice(error)`; do not add inline error boxes. The login page says that signing in ends other devices' sessions; the new device is told "other device signed out", and the old device sees the bar after its next request fails.
- Tests: `backend/tests/test_auth.py`, `frontend/src/pages/Login.test.jsx`, `frontend/src/api/client.test.js`.

## Config
`JWT_SECRET`, `JWT_EXPIRY_DAYS`, `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`, `SMS_APP_NAME`, `SMS_COUNTRY_CODE`, `OTP_IN_RESPONSE`, `SUPER_ADMIN_PHONE` (see [operations.md](../operations.md)).

## Logs
`otp_request_unknown_phone`, `otp_rate_limited`, `otp_verify_failed`, `login_ok` (with `replaced_other_session`), `sms_sent`, `sms_send_failed` (`SMS_REJECTED` or `SMS_NETWORK_ERROR`, with the provider response), `otp_generated_dev`.

## Gotchas
- A lost phone is cut off by signing in on another device (that ends the old session), by deactivating the user, or by rotating `JWT_SECRET`.
- The old device only learns it was signed out on its next API call, not instantly.
- Tests: a session-scoped fixture user must not log in a second time, or the fixture's token stops working. Use `make_club` for a fresh user.
- Wrong-attempt counting is per OTP row, not per phone.
- Every demo/dev phone is not a real number; production logins need real mobile numbers.
