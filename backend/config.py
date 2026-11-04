import os

DEV_JWT_SECRET = "swim-academy-secret-key-change-in-prod"


def _flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes")


class Settings:
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "dev")
    JWT_SECRET: str = os.getenv("JWT_SECRET", DEV_JWT_SECRET)
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    OTP_EXPIRY_MINUTES: int = 5
    OTP_LENGTH: int = 6
    OTP_MAX_REQUESTS_PER_HOUR: int = 5
    OTP_MAX_ATTEMPTS: int = 5
    # OTP delivery: MSG91 when MSG91_AUTH_KEY + MSG91_OTP_TEMPLATE_ID are set. Dev may also return the code in the response.
    MSG91_AUTH_KEY: str = os.getenv("MSG91_AUTH_KEY", "")
    MSG91_OTP_TEMPLATE_ID: str = os.getenv("MSG91_OTP_TEMPLATE_ID", "")
    SMS_APP_NAME: str = os.getenv("SMS_APP_NAME", "CadenceLanes")
    SMS_COUNTRY_CODE: str = os.getenv("SMS_COUNTRY_CODE", "91")
    OTP_IN_RESPONSE: bool = _flag("OTP_IN_RESPONSE", False)
    CORS_ORIGINS: list[str] = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
    DATA_DIR: str = os.getenv("DATA_DIR", "data")
    SUPER_ADMIN_PHONE: str = os.getenv("SUPER_ADMIN_PHONE", "9999999999")
    SUPER_ADMIN_NAME: str = "Super Admin"


settings = Settings()

if settings.ENVIRONMENT != "dev":
    if settings.JWT_SECRET == DEV_JWT_SECRET or len(settings.JWT_SECRET) < 32:
        raise RuntimeError("JWT_SECRET must be set to at least 32 characters when ENVIRONMENT is not dev")
    if settings.OTP_IN_RESPONSE:
        raise RuntimeError("OTP_IN_RESPONSE is only allowed when ENVIRONMENT=dev")
    if not (settings.MSG91_AUTH_KEY and settings.MSG91_OTP_TEMPLATE_ID):
        raise RuntimeError("MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID are required when ENVIRONMENT is not dev")
