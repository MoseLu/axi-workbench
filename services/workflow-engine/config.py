"""Configuration settings for the workflow engine service."""

import os
from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App settings
    app_name: str = "Workflow Engine"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"
    internal_service_token: str = Field(
        default="",
        validation_alias=AliasChoices("WORKFLOW_INTERNAL_SERVICE_TOKEN", "INTERNAL_SERVICE_TOKEN"),
    )

    # Server settings
    host: str = "0.0.0.0"
    port: int = Field(
        default=8000,
        validation_alias=AliasChoices("WORKFLOW_SERVICE_PORT", "PORT"),
    )

    # Runtime and migration credentials are intentionally separate. The
    # deployment only receives WORKFLOW_DATABASE_URL; the migration job may
    # receive WORKFLOW_MIGRATION_DATABASE_URL.
    database_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("WORKFLOW_DATABASE_URL", "DATABASE_URL"),
    )
    migration_database_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("WORKFLOW_MIGRATION_DATABASE_URL"),
    )

    # Execution settings
    max_concurrent_workflows: int = 10
    step_timeout_seconds: int = Field(
        default=300,
        validation_alias=AliasChoices("WORKFLOW_STEP_TIMEOUT_SECONDS", "STEP_TIMEOUT_SECONDS"),
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
