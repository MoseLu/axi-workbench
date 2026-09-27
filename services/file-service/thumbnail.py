"""Derived image thumbnail generation for the file service."""

from __future__ import annotations

import asyncio
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from PIL import Image, ImageOps, UnidentifiedImageError


@dataclass(slots=True)
class ThumbnailResult:
    """A generated thumbnail ready to be uploaded as a derived object."""

    path: Path
    width: int
    height: int
    content_type: str = "image/webp"


class ThumbnailProcessor(Protocol):
    async def create(self, source: Path, content_type: str | None) -> ThumbnailResult | None:
        """Create a thumbnail or return None when the source is not supported."""


class NoopThumbnailProcessor:
    """Development fallback that does not create derived objects."""

    async def create(self, source: Path, content_type: str | None) -> ThumbnailResult | None:
        return None


class PillowThumbnailProcessor:
    """Create bounded WebP thumbnails without trusting client image metadata."""

    _supported_content_types = frozenset(
        {
            "image/bmp",
            "image/gif",
            "image/jpeg",
            "image/png",
            "image/tiff",
            "image/webp",
        }
    )

    def __init__(self, max_width: int = 320, max_height: int = 320, quality: int = 85) -> None:
        self.max_width = max_width
        self.max_height = max_height
        self.quality = quality

    async def create(self, source: Path, content_type: str | None) -> ThumbnailResult | None:
        normalized_content_type = (content_type or "").split(";", 1)[0].strip().lower()
        if normalized_content_type not in self._supported_content_types:
            return None
        return await asyncio.to_thread(self._create_sync, source)

    def _create_sync(self, source: Path) -> ThumbnailResult | None:
        output_path: Path | None = None
        try:
            with Image.open(source) as image:
                corrected = ImageOps.exif_transpose(image)
                corrected.thumbnail((self.max_width, self.max_height), Image.Resampling.LANCZOS)
                width, height = corrected.size
                mode = "RGBA" if "A" in corrected.getbands() else "RGB"
                converted = corrected.convert(mode)
                try:
                    handle = tempfile.NamedTemporaryFile(
                        prefix="axi-thumbnail-",
                        suffix=".webp",
                        delete=False,
                        dir="/tmp",
                    )
                    output_path = Path(handle.name)
                    handle.close()
                    converted.save(output_path, format="WEBP", quality=self.quality, method=4)
                finally:
                    converted.close()
            return ThumbnailResult(path=output_path, width=width, height=height)
        except (UnidentifiedImageError, OSError, ValueError):
            if output_path is not None:
                output_path.unlink(missing_ok=True)
            return None
