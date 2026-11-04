import json
import logging
import urllib.error
import urllib.request

from config import settings
from logging_config import get_logger, log_event

log = get_logger("app.sms")

MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow"


class SMSSendError(Exception):
    pass


def sms_enabled() -> bool:
    return bool(settings.MSG91_AUTH_KEY and settings.MSG91_OTP_TEMPLATE_ID)


def send_otp(phone: str, code: str) -> None:
    """Send the login OTP through the MSG91 Flow API using the DLT-approved template.

    MSG91 template:
      ##code## is your One-Time Password (OTP) to log in to your ##name## account.
      This OTP is valid for ##min## minutes. Do not share it. -BRT International
    Recipient keys are the placeholder names: code, name, min.
    """
    payload = {
        "template_id": settings.MSG91_OTP_TEMPLATE_ID,
        "short_url": "0",
        "recipients": [{
            "mobiles": settings.SMS_COUNTRY_CODE + phone,
            "code": code,
            "name": settings.SMS_APP_NAME,
            "min": str(settings.OTP_EXPIRY_MINUTES),
        }],
    }
    req = urllib.request.Request(
        MSG91_FLOW_URL,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "authkey": settings.MSG91_AUTH_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            body = json.loads(res.read() or b"{}")
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        log_event(log, logging.ERROR, "sms_send_failed", phone_tail=phone[-4:], error_code="SMS_NETWORK_ERROR",
                  error=f"{type(e).__name__}: {e}",
                  hint="Could not reach or parse MSG91. HTTP 401/403: check MSG91_AUTH_KEY. Otherwise check outbound internet and MSG91 status.")
        raise SMSSendError() from e
    if body.get("type") != "success":
        log_event(log, logging.ERROR, "sms_send_failed", phone_tail=phone[-4:], error_code="SMS_REJECTED",
                  provider_response=json.dumps(body),
                  hint="MSG91 rejected the request. Check MSG91_OTP_TEMPLATE_ID, that the template variables are ##code## ##name## ##min##, DLT approval, and account balance.")
        raise SMSSendError()
    log_event(log, logging.INFO, "sms_sent", phone_tail=phone[-4:], provider_message_id=body.get("message"))
