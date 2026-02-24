"""Configuration module for file service."""
import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False

    # Storage settings
    storage_path: Path = Path("./storage")
    max_file_size: int = 100 * 1024 * 1024  # 100MB default

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
