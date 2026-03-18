"""
Mesh Generator
Converts a 2D heightmap into a 3D triangulated mesh.
Uses grid-based triangulation for deterministic output.
"""

import numpy as np
import trimesh


def heightmap_to_mesh(
    heightmap: np.ndarray,
    depth_mm: float = 10.0,
    width_mm: float = 100.0,
    height_mm: float = 100.0,
    base_thickness_mm: float = 2.0,
) -> trimesh.Trimesh:
    """
    Convert a heightmap array into a watertight 3D mesh.

    The mesh is a solid box with the top surface sculpted by the heightmap.
    The bottom is a flat base plate. All sides are enclosed.

    Args:
        heightmap: 2D array with values in [0, 1].
        depth_mm: Maximum relief depth in mm.
        width_mm: Physical width of the model (X axis).
        height_mm: Physical height of the model (Y axis).
        base_thickness_mm: Thickness of the flat base below the relief.

    Returns:
        trimesh.Trimesh: A watertight triangulated mesh.
    """
    rows, cols = heightmap.shape

    # Create grid coordinates
    x = np.linspace(0, width_mm, cols)
    y = np.linspace(0, height_mm, rows)
    xv, yv = np.meshgrid(x, y)

    # Z values: base_thickness + heightmap * depth
    zv_top = base_thickness_mm + heightmap * depth_mm
    zv_bottom = np.zeros_like(heightmap)

    # --- Build vertices ---
    # Top surface vertices
    top_vertices = np.column_stack([
        xv.ravel(),
        yv.ravel(),
        zv_top.ravel()
    ])

    # Bottom surface vertices
    bottom_vertices = np.column_stack([
        xv.ravel(),
        yv.ravel(),
        zv_bottom.ravel()
    ])

    n_grid = rows * cols
    all_vertices = np.vstack([top_vertices, bottom_vertices])

    faces = []

    # --- Top surface faces (normals pointing up) ---
    for r in range(rows - 1):
        for c in range(cols - 1):
            i0 = r * cols + c
            i1 = i0 + 1
            i2 = (r + 1) * cols + c
            i3 = i2 + 1

            # Two triangles per quad, CCW winding for outward normals
            faces.append([i0, i2, i1])
            faces.append([i1, i2, i3])

    # --- Bottom surface faces (normals pointing down) ---
    for r in range(rows - 1):
        for c in range(cols - 1):
            i0 = n_grid + r * cols + c
            i1 = i0 + 1
            i2 = n_grid + (r + 1) * cols + c
            i3 = i2 + 1

            # Reversed winding for bottom (normals point down)
            faces.append([i0, i1, i2])
            faces.append([i1, i3, i2])

    # --- Side walls ---
    # Front edge (row 0)
    for c in range(cols - 1):
        top_l = c
        top_r = c + 1
        bot_l = n_grid + c
        bot_r = n_grid + c + 1
        faces.append([top_l, top_r, bot_r])
        faces.append([top_l, bot_r, bot_l])

    # Back edge (last row)
    for c in range(cols - 1):
        top_l = (rows - 1) * cols + c
        top_r = top_l + 1
        bot_l = n_grid + (rows - 1) * cols + c
        bot_r = bot_l + 1
        faces.append([top_l, bot_l, bot_r])
        faces.append([top_l, bot_r, top_r])

    # Left edge (col 0)
    for r in range(rows - 1):
        top_t = r * cols
        top_b = (r + 1) * cols
        bot_t = n_grid + r * cols
        bot_b = n_grid + (r + 1) * cols
        faces.append([top_t, bot_t, bot_b])
        faces.append([top_t, bot_b, top_b])

    # Right edge (last col)
    for r in range(rows - 1):
        top_t = r * cols + (cols - 1)
        top_b = (r + 1) * cols + (cols - 1)
        bot_t = n_grid + r * cols + (cols - 1)
        bot_b = n_grid + (r + 1) * cols + (cols - 1)
        faces.append([top_t, top_b, bot_b])
        faces.append([top_t, bot_b, bot_t])

    faces = np.array(faces, dtype=np.int64)

    mesh = trimesh.Trimesh(vertices=all_vertices, faces=faces, process=True)

    # Fix normals to ensure consistency
    mesh.fix_normals()

    return mesh


def verify_watertight(mesh: trimesh.Trimesh) -> dict:
    """
    Verify mesh quality and return diagnostic info.

    Returns:
        dict with keys: is_watertight, vertex_count, face_count, volume, bounds
    """
    return {
        "is_watertight": bool(mesh.is_watertight),
        "vertex_count": int(len(mesh.vertices)),
        "face_count": int(len(mesh.faces)),
        "volume": float(mesh.volume) if mesh.is_watertight else None,
        "bounds": mesh.bounds.tolist(),
    }
