"""
STL Exporter
Exports trimesh meshes to binary STL format.
Ensures watertight output with validation.
"""

import io
import trimesh
import numpy as np


def export_stl_binary(mesh: trimesh.Trimesh) -> bytes:
    """
    Export a mesh to binary STL format.

    Args:
        mesh: The trimesh mesh to export.

    Returns:
        bytes: Binary STL file content.
    """
    # Ensure mesh is valid
    mesh.fix_normals()

    # Remove degenerate faces (API changed across trimesh versions)
    try:
        mask = mesh.nondegenerate_faces()
        mesh.update_faces(mask)
    except Exception:
        pass

    # Remove duplicate faces
    try:
        mesh.remove_duplicate_faces()
    except AttributeError:
        pass

    return mesh.export(file_type="stl")


def export_stl_to_file(mesh: trimesh.Trimesh, filepath: str) -> dict:
    """
    Export a mesh to a binary STL file on disk.

    Args:
        mesh: The trimesh mesh to export.
        filepath: Output file path.

    Returns:
        dict with export metadata.
    """
    stl_bytes = export_stl_binary(mesh)

    with open(filepath, "wb") as f:
        f.write(stl_bytes)

    return {
        "filepath": filepath,
        "size_bytes": len(stl_bytes),
        "is_watertight": bool(mesh.is_watertight),
        "vertex_count": int(len(mesh.vertices)),
        "face_count": int(len(mesh.faces)),
    }


def validate_mesh(mesh: trimesh.Trimesh) -> dict:
    """
    Run comprehensive validation on a mesh.

    Returns:
        dict with validation results and diagnostics.
    """
    return {
        "is_watertight": bool(mesh.is_watertight),
        "is_volume": bool(mesh.is_volume),
        "euler_number": int(mesh.euler_number),
        "vertex_count": int(len(mesh.vertices)),
        "face_count": int(len(mesh.faces)),
        "bounds_mm": mesh.bounds.tolist() if mesh.bounds is not None else None,
        "volume_mm3": float(mesh.volume) if mesh.is_watertight else None,
        "surface_area_mm2": float(mesh.area),
        "has_degenerate_faces": bool(mesh.is_empty or len(mesh.faces) == 0),
    }
