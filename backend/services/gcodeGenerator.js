/**
 * G-code Generator Service
 * Generates G-code for laser engraving (raster scan) and FDM printing (CuraEngine CLI).
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class GCodeGenerator {
  /**
   * Generate laser engraving G-code from heightmap.
   *
   * Uses raster scanning: each row is scanned left-to-right,
   * with laser power modulated by grayscale intensity.
   *
   * @param {number[][]} heightmap - 2D array with values in [0, 1]
   * @param {object} options - Laser parameters
   * @returns {string} G-code string
   */
  static generateLaserGCode(heightmap, options = {}) {
    const {
      feedRate = 1000,          // mm/min
      maxPower = 1000,          // S value (0-1000)
      minPower = 0,
      pixelSize = 0.1,          // mm per pixel
      lineSpacing = 0.1,        // mm between scan lines
      overscan = 2.0,           // mm overscan for acceleration
      bidirectional = true,     // alternating scan direction
      originX = 0,
      originY = 0,
    } = options;

    const rows = heightmap.length;
    const cols = heightmap[0].length;
    const lines = [];

    // Header
    lines.push('; Laser Engraving G-code');
    lines.push(`; Generated: ${new Date().toISOString()}`);
    lines.push(`; Resolution: ${cols}x${rows}`);
    lines.push(`; Pixel size: ${pixelSize}mm`);
    lines.push(`; Feed rate: ${feedRate}mm/min`);
    lines.push(`; Max power: ${maxPower}`);
    lines.push('');
    lines.push('G21 ; Millimeters');
    lines.push('G90 ; Absolute positioning');
    lines.push('M5  ; Laser off');
    lines.push(`G0 X${originX} Y${originY} F${feedRate * 2}`);
    lines.push('');
    lines.push('; Begin raster scan');

    for (let row = 0; row < rows; row++) {
      const y = originY + row * lineSpacing;
      const isForward = bidirectional ? row % 2 === 0 : true;

      // Move to start of line (with overscan)
      if (isForward) {
        lines.push(`G0 X${(originX - overscan).toFixed(3)} Y${y.toFixed(3)}`);
      } else {
        lines.push(`G0 X${(originX + cols * pixelSize + overscan).toFixed(3)} Y${y.toFixed(3)}`);
      }

      lines.push('M4 ; Dynamic laser mode');

      const colOrder = isForward
        ? Array.from({ length: cols }, (_, i) => i)
        : Array.from({ length: cols }, (_, i) => cols - 1 - i);

      for (const col of colOrder) {
        const intensity = heightmap[row][col]; // 0.0 = no power, 1.0 = max power
        const power = Math.round(minPower + intensity * (maxPower - minPower));
        const x = originX + col * pixelSize;

        lines.push(`G1 X${x.toFixed(3)} S${power} F${feedRate}`);
      }

      lines.push('M5 ; Laser off');
    }

    // Footer
    lines.push('');
    lines.push('M5 ; Laser off');
    lines.push('G0 X0 Y0 ; Return home');
    lines.push('M2 ; End program');

    return lines.join('\n');
  }

  /**
   * Generate FDM G-code using CuraEngine CLI.
   *
   * @param {string} stlFilePath - Path to STL file
   * @param {object} options - CuraEngine options
   * @returns {Promise<string>} G-code string
   */
  static async generateFDMGCode(stlFilePath, options = {}) {
    const {
      curaEnginePath = 'CuraEngine',
      profilePath = null,
      layerHeight = 0.2,
      infillDensity = 20,
      printSpeed = 60,
      nozzleDiameter = 0.4,
      filamentDiameter = 1.75,
      bedTemp = 60,
      hotendTemp = 200,
    } = options;

    // Check if CuraEngine is available
    const curaAvailable = await GCodeGenerator._checkCuraEngine(curaEnginePath);

    if (curaAvailable && profilePath) {
      // Use CuraEngine CLI
      return GCodeGenerator._runCuraEngine(stlFilePath, {
        curaEnginePath,
        profilePath,
      });
    }

    // Fallback: generate basic FDM G-code from STL
    // This is a simplified slicer for demonstration
    return GCodeGenerator._generateBasicFDMGCode(stlFilePath, {
      layerHeight,
      infillDensity,
      printSpeed,
      nozzleDiameter,
      filamentDiameter,
      bedTemp,
      hotendTemp,
    });
  }

  /**
   * Check if CuraEngine CLI is available.
   */
  static _checkCuraEngine(curaPath) {
    return new Promise((resolve) => {
      execFile(curaPath, ['--help'], (error) => {
        resolve(!error);
      });
    });
  }

  /**
   * Run CuraEngine CLI.
   */
  static _runCuraEngine(stlPath, options) {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(os.tmpdir(), `molding_${Date.now()}.gcode`);

      const args = [
        'slice',
        '-j', options.profilePath,
        '-l', stlPath,
        '-o', outputPath,
      ];

      execFile(options.curaEnginePath, args, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`CuraEngine failed: ${stderr || error.message}`));
          return;
        }

        try {
          const gcode = fs.readFileSync(outputPath, 'utf-8');
          fs.unlinkSync(outputPath); // cleanup
          resolve(gcode);
        } catch (readError) {
          reject(new Error(`Failed to read G-code output: ${readError.message}`));
        }
      });
    });
  }

  /**
   * Generate basic FDM G-code without CuraEngine.
   * Simple layer-by-layer outline for the STL bounding box.
   */
  static _generateBasicFDMGCode(stlPath, options) {
    const {
      layerHeight,
      infillDensity,
      printSpeed,
      nozzleDiameter,
      filamentDiameter,
      bedTemp,
      hotendTemp,
    } = options;

    // Read STL to get bounding dimensions
    const stlBuffer = fs.readFileSync(stlPath);
    const bounds = GCodeGenerator._getSTLBounds(stlBuffer);

    if (!bounds) {
      throw new Error('Failed to parse STL bounds');
    }

    const { minX, maxX, minY, maxY, minZ, maxZ } = bounds;
    const width = maxX - minX;
    const depth = maxY - minY;
    const height = maxZ - minZ;
    const layers = Math.ceil(height / layerHeight);

    const lines = [];

    // Header
    lines.push('; FDM G-code');
    lines.push(`; Generated: ${new Date().toISOString()}`);
    lines.push(`; Layer height: ${layerHeight}mm`);
    lines.push(`; Layers: ${layers}`);
    lines.push(`; Model size: ${width.toFixed(1)}x${depth.toFixed(1)}x${height.toFixed(1)}mm`);
    lines.push('');

    // Startup sequence
    lines.push('G21 ; Millimeters');
    lines.push('G90 ; Absolute positioning');
    lines.push('M82 ; Absolute extrusion');
    lines.push(`M104 S${hotendTemp} ; Set hotend temp`);
    lines.push(`M140 S${bedTemp} ; Set bed temp`);
    lines.push(`M190 S${bedTemp} ; Wait for bed`);
    lines.push(`M109 S${hotendTemp} ; Wait for hotend`);
    lines.push('G28 ; Home all axes');
    lines.push('G92 E0 ; Reset extruder');
    lines.push('');

    // Priming line
    lines.push('; Prime line');
    lines.push('G1 Z2.0 F3000');
    lines.push('G1 X0.1 Y20 Z0.3 F5000');
    lines.push('G1 X0.1 Y200 Z0.3 F1500 E15');
    lines.push('G1 X0.4 Y200 Z0.3 F5000');
    lines.push('G1 X0.4 Y20 Z0.3 F1500 E30');
    lines.push('G92 E0');
    lines.push('G1 Z2.0 F3000');
    lines.push('');

    // Center the model on the bed
    const bedCenterX = 110; // Typical 220mm bed
    const bedCenterY = 110;
    const offsetX = bedCenterX - width / 2;
    const offsetY = bedCenterY - depth / 2;

    let e = 0; // Extruder position
    const extrusionMultiplier = (nozzleDiameter * layerHeight) / (Math.PI * (filamentDiameter / 2) ** 2);
    const infillSpacing = nozzleDiameter / (infillDensity / 100);

    // Generate layers
    for (let layer = 0; layer < layers; layer++) {
      const z = (layer + 1) * layerHeight;
      lines.push(`; Layer ${layer + 1}/${layers}`);
      lines.push(`G1 Z${z.toFixed(3)} F600`);

      // Perimeter (outline)
      const x0 = offsetX;
      const y0 = offsetY;
      const x1 = offsetX + width;
      const y1 = offsetY + depth;

      // Move to start
      lines.push(`G0 X${x0.toFixed(3)} Y${y0.toFixed(3)} F${printSpeed * 60}`);

      // Extrude perimeter
      const perimeterLength = 2 * (width + depth);
      e += perimeterLength * extrusionMultiplier;
      lines.push(`G1 X${x1.toFixed(3)} Y${y0.toFixed(3)} E${e.toFixed(4)} F${printSpeed * 60}`);
      e += depth * extrusionMultiplier;
      lines.push(`G1 X${x1.toFixed(3)} Y${y1.toFixed(3)} E${e.toFixed(4)}`);
      e += width * extrusionMultiplier;
      lines.push(`G1 X${x0.toFixed(3)} Y${y1.toFixed(3)} E${e.toFixed(4)}`);
      e += depth * extrusionMultiplier;
      lines.push(`G1 X${x0.toFixed(3)} Y${y0.toFixed(3)} E${e.toFixed(4)}`);

      // Simple line infill
      if (infillDensity > 0) {
        const isEvenLayer = layer % 2 === 0;
        if (isEvenLayer) {
          // Horizontal lines
          for (let iy = y0 + infillSpacing; iy < y1; iy += infillSpacing) {
            e += width * extrusionMultiplier;
            lines.push(`G0 X${x0.toFixed(3)} Y${iy.toFixed(3)}`);
            lines.push(`G1 X${x1.toFixed(3)} Y${iy.toFixed(3)} E${e.toFixed(4)}`);
          }
        } else {
          // Vertical lines
          for (let ix = x0 + infillSpacing; ix < x1; ix += infillSpacing) {
            e += depth * extrusionMultiplier;
            lines.push(`G0 X${ix.toFixed(3)} Y${y0.toFixed(3)}`);
            lines.push(`G1 X${ix.toFixed(3)} Y${y1.toFixed(3)} E${e.toFixed(4)}`);
          }
        }
      }

      lines.push('');
    }

    // Footer
    lines.push('; End G-code');
    lines.push('M104 S0 ; Turn off hotend');
    lines.push('M140 S0 ; Turn off bed');
    lines.push('G91 ; Relative positioning');
    lines.push('G1 E-2 F2700 ; Retract');
    lines.push('G1 Z10 F3000 ; Lift');
    lines.push('G90 ; Absolute positioning');
    lines.push('G0 X0 Y220 F3000 ; Present print');
    lines.push('M84 ; Disable steppers');
    lines.push('M2 ; End');

    return lines.join('\n');
  }

  /**
   * Parse binary STL bounding box.
   */
  static _getSTLBounds(buffer) {
    try {
      // Binary STL: 80-byte header, 4-byte triangle count, then triangles
      if (buffer.length < 84) return null;

      const view = new DataView(buffer.buffer || new Uint8Array(buffer).buffer);
      const triCount = view.getUint32(80, true);

      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      for (let i = 0; i < triCount; i++) {
        const offset = 84 + i * 50;
        // Skip normal (12 bytes), read 3 vertices (36 bytes)
        for (let v = 0; v < 3; v++) {
          const vOffset = offset + 12 + v * 12;
          const x = view.getFloat32(vOffset, true);
          const y = view.getFloat32(vOffset + 4, true);
          const z = view.getFloat32(vOffset + 8, true);

          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          minZ = Math.min(minZ, z);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          maxZ = Math.max(maxZ, z);
        }
      }

      return { minX, maxX, minY, maxY, minZ, maxZ };
    } catch {
      return null;
    }
  }
}

module.exports = { GCodeGenerator };
