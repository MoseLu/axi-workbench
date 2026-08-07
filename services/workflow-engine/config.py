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
    max_concurrent_workflows: int = Field(
        default=10,
        validation_alias=AliasChoices(
            "WORKFLOW_MAX_CONCURRENT_WORKFLOWS", "MAX_CONCURRENT_WORKFLOWS"
        ),
    )
    step_timeout_seconds: int = Field(
        default=300,
        validation_alias=AliasChoices("WORKFLOW_STEP_TIMEOUT_SECONDS", "STEP_TIMEOUT_SECONDS"),
    )
    dispatch_lease_seconds: int = Field(
        default=360,
        validation_alias=AliasChoices("WORKFLOW_DISPATCH_LEASE_SECONDS", "DISPATCH_LEASE_SECONDS"),
    )
    dispatch_poll_interval_seconds: float = Field(
        default=1.0,
        validation_alias=AliasChoices(
            "WORKFLOW_DISPATCH_POLL_INTERVAL_SECONDS", "DISPATCH_POLL_INTERVAL_SECONDS"
        ),
    )
    max_dispatch_attempts: int = Field(
        default=10,
        validation_alias=AliasChoices("WORKFLOW_MAX_DISPATCH_ATTEMPTS", "MAX_DISPATCH_ATTEMPTS"),
    )
    dispatch_retry_base_seconds: int = Field(
        default=5,
        validation_alias=AliasChoices(
            "WORKFLOW_DISPATCH_RETRY_BASE_SECONDS", "DISPATCH_RETRY_BASE_SECONDS"
        ),
    )
    dispatch_retry_max_seconds: int = Field(
        default=300,
        validation_alias=AliasChoices(
            "WORKFLOW_DISPATCH_RETRY_MAX_SECONDS", "DISPATCH_RETRY_MAX_SECONDS"
        ),
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
