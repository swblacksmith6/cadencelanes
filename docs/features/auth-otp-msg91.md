# Authentication: OTP login with MSG91

## Purpose
Phone-number login with a one-time password sent by SMS. No passwords. A login lasts 30 days.

## Behaviour
1. `POST /api/auth/request-otp {phone}`: the phone must belong to an active user, else 404. A 6-digit code (from `secrets`) is stored in `otp_codes`, valid 5 minutes.
2. At most 5 OTP requests per phone per hour, else 429.
3. If `MSG91_AUTH_KEY` and `MSG91_OTP_TEMPLATE_ID` are set, the code is sent by SMS; if MSG91 fails the response is 502 and no code is revealed.
   If they are not set (dev only) the code is logged as `otp_generated_dev`.
4. The code is returned in the response only when `OTP_IN_RESPONSE=true` (dev only; startup refuses it elsewhere).
5. `POST /api/auth/verify-otp {phone, code}`: uses the newest unused, unexpired code. 5 wrong attempts burn the code. Success marks it used and returns `{access_token, user}`.
6. The JWT carries `user_id, phone, role, club_id, name, exp` and lasts `JWT_EXPIRY_DAYS` (30). It is a fixed lifetime, not extended by use.
7. On every request the user is looked up in control.db; an inactive or missing user gets 401 immediately, so deactivating a coach takes effect at once.
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
- Frontend: `frontend/src/pages/Login.jsx`, `context/AuthContext.jsx`, `api/client.js` (401 logs out).
- Tests: `backend/tests/test_auth.py`, `frontend/src/pages/Login.test.jsx`, `frontend/src/api/client.test.js`.

## Config
`JWT_SECRET`, `JWT_EXPIRY_DAYS`, `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`, `SMS_APP_NAME`, `SMS_COUNTRY_CODE`, `OTP_IN_RESPONSE`, `SUPER_ADMIN_PHONE` (see [operations.md](../operations.md)).

## Logs
`otp_request_unknown_phone`, `otp_rate_limited`, `otp_verify_failed`, `login_ok`, `sms_sent`, `sms_send_failed` (`SMS_REJECTED` or `SMS_NETWORK_ERROR`, with the provider response), `otp_generated_dev`.

## Gotchas
- A 24-hour-to-30-day change means a stolen phone stays logged in until the user is deactivated or the token expires; there is no logout-everywhere (rotate `JWT_SECRET` to force it).
- Wrong-attempt counting is per OTP row, not per phone.
- Every demo/dev phone is not a real number; production logins need real mobile numbers.
