/**
 * Python Bridge Service
 * Communicates with the Python geometry microservice via HTTP.
 */

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

class PythonBridge {
  constructor(baseUrl = PYTHON_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  async healthCheck() {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json();
  }

  /**
   * Generate heightmap from base64 image data.
   */
  async generateHeightmap(imageBase64, options = {}) {
    const body = {
      image: imageBase64,
      resolution: options.resolution || 256,
      invert: options.invert || false,
      blur: options.blur || 1.0,
    };

    const res = await fetch(`${this.baseUrl}/api/heightmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Heightmap generation failed');
    }

    return res.json();
  }

  /**
   * Generate heightmap from file buffer.
   */
  async generateHeightmapFromFile(fileBuffer, filename, options = {}) {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', fileBuffer, { filename });
    form.append('resolution', String(options.resolution || 256));
    form.append('invert', String(options.invert || false));
    form.append('blur', String(options.blur || 1.0));

    const res = await fetch(`${this.baseUrl}/api/heightmap`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders ? form.getHeaders() : {},
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Heightmap generation failed');
    }

    return res.json();
  }

  /**
   * Generate 3D mesh from heightmap job.
   */
  async generateMesh(jobId, options = {}) {
    const body = {
      job_id: jobId,
      depth_mm: options.depthMm || 10,
      width_mm: options.widthMm || 100,
      height_mm: options.heightMm || 100,
      base_thickness_mm: options.baseThicknessMm || 2,
    };

    const res = await fetch(`${this.baseUrl}/api/mesh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Mesh generation failed');
    }

    return res.json();
  }

  /**
   * Generate negative mold.
   */
  async generateMold(jobId, options = {}) {
    const body = {
      job_id: jobId,
      wall_thickness_mm: options.wallThicknessMm || 5,
      floor_thickness_mm: options.floorThicknessMm || 3,
    };

    const res = await fetch(`${this.baseUrl}/api/mold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Mold generation failed');
    }

    return res.json();
  }

  /**
   * Export STL file.
   */
  async exportSTL(jobId, meshType = 'relief') {
    const res = await fetch(`${this.baseUrl}/api/export/stl/${meshType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'STL export failed');
    }

    return res.arrayBuffer();
  }

  /**
   * Run full pipeline.
   */
  async fullPipeline(imageBase64, options = {}) {
    const body = {
      image: imageBase64,
      resolution: options.resolution || 256,
      invert: options.invert || false,
      blur: options.blur || 1.0,
      depth_mm: options.depthMm || 10,
      width_mm: options.widthMm || 100,
      height_mm: options.heightMm || 100,
      base_thickness_mm: options.baseThicknessMm || 2,
      wall_thickness_mm: options.wallThicknessMm || 5,
      floor_thickness_mm: options.floorThicknessMm || 3,
    };

    const res = await fetch(`${this.baseUrl}/api/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Pipeline failed');
    }

    return res.json();
  }

  /**
   * Export heightmap data for G-code generation.
   */
  async exportHeightmap(jobId) {
    const res = await fetch(`${this.baseUrl}/api/export/heightmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Heightmap export failed');
    }

    return res.json();
  }
}

module.exports = { PythonBridge };
