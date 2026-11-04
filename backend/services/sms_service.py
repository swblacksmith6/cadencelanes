import json
import logging
import urllib.error
import urllib.request

from config import settings

logger = logging.getLogger("uvicorn.error")

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
        logger.error("MSG91 request failed for ...%s: %s", phone[-4:], e)
        raise SMSSendError() from e
    if body.get("type") != "success":
        logger.error("MSG91 rejected OTP for ...%s: %s", phone[-4:], body)
        raise SMSSendError()
