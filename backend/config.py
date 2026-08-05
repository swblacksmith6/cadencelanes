import os


class Settings:
    JWT_SECRET: str = os.getenv("JWT_SECRET", "swim-academy-secret-key-change-in-prod")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    OTP_EXPIRY_MINUTES: int = 5
    OTP_LENGTH: int = 6
    DATA_DIR: str = os.getenv("DATA_DIR", "data")
    SUPER_ADMIN_PHONE: str = "9999999999"
    SUPER_ADMIN_NAME: str = "Super Admin"


settings = Settings()
