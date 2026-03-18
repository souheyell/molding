/**
 * API Client for Molding Backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class MoldingAPI {
  /**
   * Run the full processing pipeline.
   * @param {string} imageBase64 - Base64-encoded image data URL
   * @param {object} params - Processing parameters
   * @returns {Promise<object>} Pipeline results
   */
  static async runFullPipeline(imageBase64, params = {}) {
    const res = await fetch(`${API_BASE}/api/process/full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageBase64,
        resolution: params.resolution || 256,
        invert: params.invert || false,
        blur: params.blur || 1.0,
        depthMm: params.depthMm || 10,
        widthMm: params.widthMm || 100,
        heightMm: params.heightMm || 100,
        baseThicknessMm: params.baseThicknessMm || 2,
        wallThicknessMm: params.wallThicknessMm || 5,
        floorThicknessMm: params.floorThicknessMm || 3,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Pipeline failed');
    }

    return res.json();
  }

  /**
   * Generate heightmap only.
   */
  static async generateHeightmap(imageBase64, params = {}) {
    const res = await fetch(`${API_BASE}/api/process/heightmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageBase64,
        resolution: String(params.resolution || 256),
        invert: String(params.invert || false),
        blur: String(params.blur || 1.0),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Heightmap generation failed');
    }

    return res.json();
  }

  /**
   * Generate mesh from existing job.
   */
  static async generateMesh(jobId, params = {}) {
    const res = await fetch(`${API_BASE}/api/process/mesh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        depthMm: params.depthMm || 10,
        widthMm: params.widthMm || 100,
        heightMm: params.heightMm || 100,
        baseThicknessMm: params.baseThicknessMm || 2,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Mesh generation failed');
    }

    return res.json();
  }

  /**
   * Generate mold from existing job.
   */
  static async generateMold(jobId, params = {}) {
    const res = await fetch(`${API_BASE}/api/process/mold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        wallThicknessMm: params.wallThicknessMm || 5,
        floorThicknessMm: params.floorThicknessMm || 3,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Mold generation failed');
    }

    return res.json();
  }

  /**
   * Download STL file.
   */
  static async downloadSTL(jobId, meshType = 'relief') {
    const res = await fetch(`${API_BASE}/api/export/stl/${meshType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'STL download failed');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meshType}_${jobId.slice(0, 8)}.stl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Generate and download laser G-code.
   */
  static async downloadLaserGCode(jobId, params = {}) {
    const res = await fetch(`${API_BASE}/api/gcode/laser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        feedRate: params.feedRate || 1000,
        maxPower: params.maxPower || 1000,
        minPower: params.minPower || 0,
        pixelSize: params.pixelSize || 0.1,
        lineSpacing: params.lineSpacing || 0.1,
        overscan: params.overscan || 2.0,
        bidirectional: params.bidirectional !== false,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Laser G-code generation failed');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laser_${jobId.slice(0, 8)}.gcode`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Generate and download FDM G-code.
   */
  static async downloadFDMGCode(jobId, params = {}) {
    const res = await fetch(`${API_BASE}/api/gcode/fdm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        meshType: params.meshType || 'mold',
        layerHeight: params.layerHeight || 0.2,
        infillDensity: params.infillDensity || 20,
        printSpeed: params.printSpeed || 60,
        nozzleDiameter: params.nozzleDiameter || 0.4,
        filamentDiameter: params.filamentDiameter || 1.75,
        bedTemp: params.bedTemp || 60,
        hotendTemp: params.hotendTemp || 200,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'FDM G-code generation failed');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fdm_${params.meshType || 'mold'}_${jobId.slice(0, 8)}.gcode`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Health check.
   */
  static async healthCheck() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}

export default MoldingAPI;
