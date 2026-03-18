"""
Heightmap Generator
Converts input images to normalized grayscale heightmaps.
Supports PNG, JPEG, SVG (rasterized), and raw canvas data.
"""

import numpy as np
from PIL import Image, ImageFilter
import io
import base64
import re


def decode_base64_image(data_url: str) -> Image.Image:
    """Decode a base64 data URL or raw base64 string into a PIL Image."""
    if "," in data_url:
        # data:image/png;base64,<data>
        header, encoded = data_url.split(",", 1)
    else:
        encoded = data_url
    image_bytes = base64.b64decode(encoded)
    return Image.open(io.BytesIO(image_bytes))


def image_to_heightmap(
    image: Image.Image,
    resolution: int = 256,
    invert: bool = False,
    blur_radius: float = 1.0,
) -> np.ndarray:
    """
    Convert a PIL Image to a normalized heightmap array.

    Args:
        image: Input PIL Image (any mode).
        resolution: Output resolution (square). Max 1024.
        invert: If True, dark areas become tall (default: light = tall).
        blur_radius: Gaussian blur radius for smoothing.

    Returns:
        np.ndarray of shape (resolution, resolution) with values in [0.0, 1.0].
    """
    resolution = min(max(resolution, 16), 1024)

    # Convert to grayscale
    gray = image.convert("L")

    # Resize to target resolution (square, maintaining content)
    gray = gray.resize((resolution, resolution), Image.Resampling.LANCZOS)

    # Apply Gaussian blur for smoother mesh
    if blur_radius > 0:
        gray = gray.filter(ImageFilter.GaussianBlur(radius=blur_radius))

    # Convert to numpy and normalize to [0, 1]
    heightmap = np.array(gray, dtype=np.float64) / 255.0

    if invert:
        heightmap = 1.0 - heightmap

    return heightmap


def heightmap_from_bytes(
    file_bytes: bytes,
    resolution: int = 256,
    invert: bool = False,
    blur_radius: float = 1.0,
) -> np.ndarray:
    """Create heightmap from raw file bytes."""
    image = Image.open(io.BytesIO(file_bytes))
    return image_to_heightmap(image, resolution, invert, blur_radius)


def heightmap_from_base64(
    data_url: str,
    resolution: int = 256,
    invert: bool = False,
    blur_radius: float = 1.0,
) -> np.ndarray:
    """Create heightmap from a base64-encoded image (data URL or raw)."""
    image = decode_base64_image(data_url)
    return image_to_heightmap(image, resolution, invert, blur_radius)


def heightmap_to_preview(heightmap: np.ndarray) -> str:
    """Convert a heightmap back to a base64 PNG for preview."""
    img_array = (heightmap * 255).astype(np.uint8)
    image = Image.fromarray(img_array, mode="L")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    encoded = base64.b64encode(buffer.read()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"
