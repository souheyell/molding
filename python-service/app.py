"""
Python Geometry Microservice
Flask API for heightmap generation, mesh creation, mold building, and STL export.
"""

import os
import io
import uuid
import json
import tempfile
import traceback

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import numpy as np

from services.heightmap import (
    heightmap_from_bytes,
    heightmap_from_base64,
    heightmap_to_preview,
)
from services.mesh_generator import heightmap_to_mesh, verify_watertight
from services.mold_creator import create_mold
from services.stl_exporter import export_stl_binary, validate_mesh

app = Flask(__name__)
CORS(app)

# In-memory job store (for production, use Redis or similar)
jobs = {}

UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "molding_uploads")
OUTPUT_DIR = os.path.join(tempfile.gettempdir(), "molding_outputs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "python-geometry"})


@app.route("/api/heightmap", methods=["POST"])
def generate_heightmap():
    """
    Generate a heightmap from an uploaded image or base64 data.

    Accepts:
        - multipart/form-data with 'file' field
        - JSON body with 'image' (base64 data URL)

    Query params / JSON fields:
        - resolution (int): Output resolution, default 256, max 1024
        - invert (bool): Invert heightmap, default false
        - blur (float): Gaussian blur radius, default 1.0
    """
    try:
        resolution = int(request.args.get("resolution", request.form.get("resolution", 256)))
        invert = request.args.get("invert", request.form.get("invert", "false")).lower() == "true"
        blur = float(request.args.get("blur", request.form.get("blur", 1.0)))

        if request.content_type and "multipart" in request.content_type:
            file = request.files.get("file")
            if not file:
                return jsonify({"error": "No file uploaded"}), 400
            file_bytes = file.read()
            heightmap = heightmap_from_bytes(file_bytes, resolution, invert, blur)
        else:
            data = request.get_json(force=True)
            if "image" not in data:
                return jsonify({"error": "No image data provided"}), 400
            heightmap = heightmap_from_base64(data["image"], resolution, invert, blur)

        # Store heightmap for later use
        job_id = str(uuid.uuid4())
        jobs[job_id] = {
            "heightmap": heightmap,
            "resolution": resolution,
        }

        preview = heightmap_to_preview(heightmap)

        return jsonify({
            "job_id": job_id,
            "preview": preview,
            "resolution": resolution,
            "shape": list(heightmap.shape),
            "min_value": float(heightmap.min()),
            "max_value": float(heightmap.max()),
            "heightmap_data": heightmap.tolist(),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/mesh", methods=["POST"])
def generate_mesh():
    """
    Generate a 3D mesh from a heightmap.

    JSON body:
        - job_id (str): ID from /api/heightmap
        - depth_mm (float): Relief depth, default 10
        - width_mm (float): Model width, default 100
        - height_mm (float): Model height, default 100
        - base_thickness_mm (float): Base thickness, default 2
    """
    try:
        data = request.get_json(force=True)
        job_id = data.get("job_id")

        if not job_id or job_id not in jobs:
            return jsonify({"error": "Invalid or missing job_id"}), 400

        heightmap = jobs[job_id]["heightmap"]

        depth_mm = float(data.get("depth_mm", 10.0))
        width_mm = float(data.get("width_mm", 100.0))
        height_mm = float(data.get("height_mm", 100.0))
        base_thickness = float(data.get("base_thickness_mm", 2.0))

        mesh = heightmap_to_mesh(
            heightmap,
            depth_mm=depth_mm,
            width_mm=width_mm,
            height_mm=height_mm,
            base_thickness_mm=base_thickness,
        )

        # Store mesh
        jobs[job_id]["mesh"] = mesh
        jobs[job_id]["params"] = {
            "depth_mm": depth_mm,
            "width_mm": width_mm,
            "height_mm": height_mm,
            "base_thickness_mm": base_thickness,
        }

        diagnostics = verify_watertight(mesh)

        # Generate vertices and faces for Three.js preview
        vertices = mesh.vertices.tolist()
        faces = mesh.faces.tolist()

        return jsonify({
            "job_id": job_id,
            "diagnostics": diagnostics,
            "vertex_count": len(vertices),
            "face_count": len(faces),
            "vertices": vertices,
            "faces": faces,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/mold", methods=["POST"])
def generate_mold():
    """
    Generate a negative mold from the relief mesh.

    JSON body:
        - job_id (str): ID with existing mesh
        - wall_thickness_mm (float): Wall thickness, default 5
        - floor_thickness_mm (float): Floor thickness, default 3
    """
    try:
        data = request.get_json(force=True)
        job_id = data.get("job_id")

        if not job_id or job_id not in jobs or "mesh" not in jobs[job_id]:
            return jsonify({"error": "Invalid job_id or mesh not generated yet"}), 400

        relief_mesh = jobs[job_id]["mesh"]
        wall_thickness = float(data.get("wall_thickness_mm", 5.0))
        floor_thickness = float(data.get("floor_thickness_mm", 3.0))

        mold = create_mold(
            relief_mesh,
            wall_thickness_mm=wall_thickness,
            floor_thickness_mm=floor_thickness,
        )

        jobs[job_id]["mold"] = mold

        diagnostics = validate_mesh(mold)
        vertices = mold.vertices.tolist()
        faces = mold.faces.tolist()

        return jsonify({
            "job_id": job_id,
            "diagnostics": diagnostics,
            "vertex_count": len(vertices),
            "face_count": len(faces),
            "vertices": vertices,
            "faces": faces,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/export/stl/<mesh_type>", methods=["POST"])
def export_stl(mesh_type):
    """
    Export mesh as binary STL.

    URL params:
        mesh_type: 'relief' or 'mold'

    JSON body:
        - job_id: Job identifier
    """
    try:
        data = request.get_json(force=True)
        job_id = data.get("job_id")

        if not job_id or job_id not in jobs:
            return jsonify({"error": "Invalid job_id"}), 400

        if mesh_type == "relief":
            mesh = jobs[job_id].get("mesh")
        elif mesh_type == "mold":
            mesh = jobs[job_id].get("mold")
        else:
            return jsonify({"error": "mesh_type must be 'relief' or 'mold'"}), 400

        if mesh is None:
            return jsonify({"error": f"{mesh_type} mesh not generated yet"}), 400

        stl_bytes = export_stl_binary(mesh)

        return send_file(
            io.BytesIO(stl_bytes),
            mimetype="application/octet-stream",
            as_attachment=True,
            download_name=f"{mesh_type}_{job_id[:8]}.stl",
        )

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/export/heightmap", methods=["POST"])
def export_heightmap():
    """Export raw heightmap data as JSON for G-code generation."""
    try:
        data = request.get_json(force=True)
        job_id = data.get("job_id")

        if not job_id or job_id not in jobs:
            return jsonify({"error": "Invalid job_id"}), 400

        heightmap = jobs[job_id].get("heightmap")
        if heightmap is None:
            return jsonify({"error": "No heightmap generated"}), 400

        return jsonify({
            "job_id": job_id,
            "heightmap": heightmap.tolist(),
            "shape": list(heightmap.shape),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/process", methods=["POST"])
def full_pipeline():
    """
    Run the full pipeline: heightmap → mesh → mold → STL metadata.

    Accepts multipart with 'file' or JSON with 'image'.
    Returns job_id and all diagnostics.
    """
    try:
        # Extract parameters
        if request.content_type and "multipart" in request.content_type:
            resolution = int(request.form.get("resolution", 256))
            invert = request.form.get("invert", "false").lower() == "true"
            blur = float(request.form.get("blur", 1.0))
            depth_mm = float(request.form.get("depth_mm", 10.0))
            width_mm = float(request.form.get("width_mm", 100.0))
            height_mm = float(request.form.get("height_mm", 100.0))
            base_thickness = float(request.form.get("base_thickness_mm", 2.0))
            wall_thickness = float(request.form.get("wall_thickness_mm", 5.0))
            floor_thickness = float(request.form.get("floor_thickness_mm", 3.0))

            file = request.files.get("file")
            if not file:
                return jsonify({"error": "No file uploaded"}), 400
            file_bytes = file.read()
            heightmap = heightmap_from_bytes(file_bytes, resolution, invert, blur)
        else:
            data = request.get_json(force=True)
            resolution = int(data.get("resolution", 256))
            invert = data.get("invert", False)
            blur = float(data.get("blur", 1.0))
            depth_mm = float(data.get("depth_mm", 10.0))
            width_mm = float(data.get("width_mm", 100.0))
            height_mm = float(data.get("height_mm", 100.0))
            base_thickness = float(data.get("base_thickness_mm", 2.0))
            wall_thickness = float(data.get("wall_thickness_mm", 5.0))
            floor_thickness = float(data.get("floor_thickness_mm", 3.0))

            if "image" not in data:
                return jsonify({"error": "No image data provided"}), 400
            heightmap = heightmap_from_base64(data["image"], resolution, invert, blur)

        job_id = str(uuid.uuid4())

        # Generate mesh
        mesh = heightmap_to_mesh(
            heightmap,
            depth_mm=depth_mm,
            width_mm=width_mm,
            height_mm=height_mm,
            base_thickness_mm=base_thickness,
        )

        # Generate mold
        mold = create_mold(
            mesh,
            wall_thickness_mm=wall_thickness,
            floor_thickness_mm=floor_thickness,
        )

        # Store everything
        jobs[job_id] = {
            "heightmap": heightmap,
            "mesh": mesh,
            "mold": mold,
            "resolution": resolution,
        }

        preview = heightmap_to_preview(heightmap)

        return jsonify({
            "job_id": job_id,
            "preview": preview,
            "heightmap_shape": list(heightmap.shape),
            "relief": {
                "diagnostics": verify_watertight(mesh),
                "vertices": mesh.vertices.tolist(),
                "faces": mesh.faces.tolist(),
            },
            "mold": {
                "diagnostics": validate_mesh(mold),
                "vertices": mold.vertices.tolist(),
                "faces": mold.faces.tolist(),
            },
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PYTHON_SERVICE_PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
