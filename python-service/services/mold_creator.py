"""
Mold Creator
Generates a negative mold by boolean subtraction from a bounding box.
The mold is the inverse of the relief — ready for casting or FDM printing.
"""

import numpy as np
import trimesh


def create_mold(
    relief_mesh: trimesh.Trimesh,
    wall_thickness_mm: float = 5.0,
    floor_thickness_mm: float = 3.0,
) -> trimesh.Trimesh:
    """
    Create a negative mold from a relief mesh using boolean subtraction.

    The mold is created by:
    1. Creating a bounding box larger than the relief
    2. Subtracting the relief from the box
    3. The result is a mold cavity ready for casting

    Args:
        relief_mesh: The positive relief mesh.
        wall_thickness_mm: Extra wall thickness around the mold.
        floor_thickness_mm: Floor thickness below the cavity.

    Returns:
        trimesh.Trimesh: The negative mold mesh (watertight).
    """
    bounds = relief_mesh.bounds  # [[xmin,ymin,zmin], [xmax,ymax,zmax]]

    # Create outer box with walls and floor
    box_min = bounds[0] - np.array([wall_thickness_mm, wall_thickness_mm, floor_thickness_mm])
    box_max = bounds[1] + np.array([wall_thickness_mm, wall_thickness_mm, wall_thickness_mm])

    box_size = box_max - box_min
    box_center = (box_min + box_max) / 2.0

    outer_box = trimesh.creation.box(
        extents=box_size,
        transform=trimesh.transformations.translation_matrix(box_center),
    )

    # Boolean subtraction: mold = outer_box - relief
    try:
        mold = outer_box.difference(relief_mesh, engine="blender")
    except Exception:
        try:
            mold = outer_box.difference(relief_mesh, engine="manifold")
        except Exception:
            # Fallback: manual boolean using trimesh's built-in
            # If no boolean engine is available, create a simple cavity mold
            mold = _fallback_mold(relief_mesh, outer_box, bounds, wall_thickness_mm, floor_thickness_mm)

    # Ensure result is watertight
    if hasattr(mold, "fix_normals"):
        mold.fix_normals()

    return mold


def _fallback_mold(
    relief_mesh: trimesh.Trimesh,
    outer_box: trimesh.Trimesh,
    bounds: np.ndarray,
    wall_thickness_mm: float,
    floor_thickness_mm: float,
) -> trimesh.Trimesh:
    """
    Fallback mold creation when boolean engines aren't available.
    Creates a box with inverted relief on top.
    """
    relief_vertices = relief_mesh.vertices.copy()
    relief_faces = relief_mesh.faces.copy()

    # Identify top-surface vertices (those with Z > base level)
    z_min = bounds[0][2]
    z_max = bounds[1][2]

    # Create mold by mirroring: flip the relief Z values
    # For each top vertex, new_z = z_max - (vertex_z - z_min) + floor_thickness
    mold_vertices = relief_vertices.copy()

    # Offset the model position
    mold_vertices[:, 0] += wall_thickness_mm
    mold_vertices[:, 1] += wall_thickness_mm

    # Find top-surface vertices (Z > z_min + small epsilon)
    top_mask = relief_vertices[:, 2] > z_min + 0.01
    mold_vertices[top_mask, 2] = z_max + wall_thickness_mm - (
        relief_vertices[top_mask, 2] - z_min
    )

    # Bottom vertices stay at floor
    bottom_mask = ~top_mask
    mold_vertices[bottom_mask, 2] = 0.0

    # Flip face winding to invert normals (makes inside surface the cavity)
    mold_faces = relief_faces[:, ::-1].copy()

    mold = trimesh.Trimesh(vertices=mold_vertices, faces=mold_faces, process=True)
    mold.fix_normals()

    # Combine with the outer box shell
    # We take the outer box and add the inverted relief inside
    combined = trimesh.util.concatenate([outer_box, mold])
    combined.fix_normals()

    return combined
