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

    # Storage settings
    storage_path: Path = Field(
        default=Path("./storage"),
        validation_alias=AliasChoices("FILE_STORAGE_PATH", "STORAGE_PATH"),
    )
    max_file_size: int = Field(
        default=100 * 1024 * 1024,
        validation_alias=AliasChoices("FILE_MAX_FILE_SIZE", "MAX_FILE_SIZE"),
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
