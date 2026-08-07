"""Pydantic models for file service."""
from datetime import datetime
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field


class FileInfo(BaseModel):
    """Model representing a file in storage."""

    name: str = Field(..., description="File name")
    path: str = Field(..., description="Relative path to file")
    size: int = Field(..., description="File size in bytes")
    created_at: datetime = Field(..., description="File creation timestamp")
    modified_at: datetime = Field(..., description="File last modification timestamp")
    content_type: Optional[str] = Field(None, description="MIME content type")

    class Config:
        from_attributes = True


class FileUploadResponse(BaseModel):
    """Response model for file upload."""

    name: str = Field(..., description="Uploaded file name")
    path: str = Field(..., description="Relative path to uploaded file")
    size: int = Field(..., description="File size in bytes")
    message: str = Field(..., description="Success message")


class FileListResponse(BaseModel):
    """Response model for file listing."""

    files: list[FileInfo] = Field(default_factory=list, description="List of files")
    total: int = Field(..., description="Total number of files")


class DeleteResponse(BaseModel):
    """Response model for file deletion."""

    message: str = Field(..., description="Success message")
    deleted_file: str = Field(..., description="Name of deleted file")


class PresignedURLResponse(BaseModel):
    """Short-lived object-storage download URL."""

    url: str = Field(..., description="Short-lived download URL")
    expires_in: int = Field(..., description="URL lifetime in seconds")


class HealthResponse(BaseModel):
    """Response model for health check."""

    status: str = Field(..., description="Service status")
    storage_path: str = Field(..., description="Configured storage path")
    max_file_size: int = Field(..., description="Maximum allowed file size")
