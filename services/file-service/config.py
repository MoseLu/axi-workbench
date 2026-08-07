"""Configuration module for file service."""
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server settings
    host: str = "0.0.0.0"
    port: int = Field(
        default=8000,
        validation_alias=AliasChoices("FILE_SERVICE_PORT", "PORT"),
    )
    reload: bool = False
    environment: str = "development"
    internal_service_token: str = Field(
        default="",
        validation_alias=AliasChoices("FILE_INTERNAL_SERVICE_TOKEN", "INTERNAL_SERVICE_TOKEN"),
    )
    database_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FILE_DATABASE_URL", "DATABASE_URL"),
    )
    migration_database_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FILE_MIGRATION_DATABASE_URL"),
    )

    # Storage settings
    storage_path: Path = Field(
        default=Path("./storage"),
        validation_alias=AliasChoices("FILE_STORAGE_PATH", "STORAGE_PATH"),
    )
    max_file_size: int = Field(
        default=100 * 1024 * 1024,
        validation_alias=AliasChoices("FILE_MAX_FILE_SIZE", "MAX_FILE_SIZE"),
    )
    storage_backend: str = Field(
        default="local",
        validation_alias=AliasChoices("FILE_STORAGE_BACKEND"),
    )
    s3_endpoint_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FILE_S3_ENDPOINT_URL"),
    )
    s3_bucket: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FILE_S3_BUCKET"),
    )
    s3_region: str = Field(
        default="us-east-1",
        validation_alias=AliasChoices("FILE_S3_REGION"),
    )
    s3_access_key_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FILE_S3_ACCESS_KEY_ID"),
    )
    s3_secret_access_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("FILE_S3_SECRET_ACCESS_KEY"),
    )
    presigned_url_ttl_seconds: int = Field(
        default=900,
        validation_alias=AliasChoices("FILE_PRESIGNED_URL_TTL_SECONDS"),
    )

    # Upload safety
    virus_scan_backend: str = Field(
        default="disabled",
        validation_alias=AliasChoices("FILE_VIRUS_SCAN_BACKEND"),
    )
    clamav_host: str = Field(
        default="127.0.0.1",
        validation_alias=AliasChoices("FILE_CLAMAV_HOST"),
    )
    clamav_port: int = Field(
        default=3310,
        validation_alias=AliasChoices("FILE_CLAMAV_PORT"),
    )
    virus_scan_timeout_seconds: float = Field(
        default=30.0,
        validation_alias=AliasChoices("FILE_VIRUS_SCAN_TIMEOUT_SECONDS"),
    )

    # Allowed extensions
    allowed_extensions: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


def get_settings() -> Settings:
    """Get application settings singleton."""
    return Settings()


settings = get_settings()


def ensure_storage_directory() -> None:
    """Ensure the storage directory exists."""
    settings.storage_path.mkdir(parents=True, exist_ok=True)


def validate_settings() -> None:
    """Reject development storage and missing durable state in production."""
    if settings.virus_scan_backend.lower() not in {"disabled", "clamav"}:
        raise ValueError("FILE_VIRUS_SCAN_BACKEND must be disabled or clamav")
    if settings.environment.lower() != "production":
        return
    if not settings.internal_service_token:
        raise ValueError("FILE_INTERNAL_SERVICE_TOKEN must be injected in production")
    if not settings.database_url:
        raise ValueError("FILE_DATABASE_URL must be injected in production")
    if settings.storage_backend.lower() != "s3":
        raise ValueError("FILE_STORAGE_BACKEND must be s3 in production")
    if not settings.s3_bucket or not settings.s3_access_key_id or not settings.s3_secret_access_key:
        raise ValueError("FILE_S3_BUCKET and S3 credentials must be injected in production")
    if settings.virus_scan_backend.lower() != "clamav":
        raise ValueError("FILE_VIRUS_SCAN_BACKEND=clamav is required in production")
    if not settings.clamav_host:
        raise ValueError("FILE_CLAMAV_HOST must be injected when ClamAV scanning is enabled")
