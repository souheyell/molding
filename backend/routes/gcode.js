/**
 * G-code Routes
 * Handles G-code generation for laser engraving and FDM printing.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { GCodeGenerator } = require('../services/gcodeGenerator');
const { PythonBridge } = require('../services/pythonBridge');

const router = express.Router();
const bridge = new PythonBridge();

/**
 * POST /api/gcode/laser
 * Generate laser engraving G-code from heightmap.
 */
router.post('/laser', async (req, res) => {
  try {
    const {
      jobId,
      feedRate,
      maxPower,
      minPower,
      pixelSize,
      lineSpacing,
      overscan,
      bidirectional,
    } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    // Get heightmap data from Python service
    const heightmapData = await bridge.exportHeightmap(jobId);

    const gcode = GCodeGenerator.generateLaserGCode(heightmapData.heightmap, {
      feedRate: parseFloat(feedRate || 1000),
      maxPower: parseInt(maxPower || 1000),
      minPower: parseInt(minPower || 0),
      pixelSize: parseFloat(pixelSize || 0.1),
      lineSpacing: parseFloat(lineSpacing || 0.1),
      overscan: parseFloat(overscan || 2.0),
      bidirectional: bidirectional !== false,
    });

    res.set({
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="laser_${jobId.slice(0, 8)}.gcode"`,
    });

    res.send(gcode);
  } catch (error) {
    console.error('Laser G-code error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/gcode/fdm
 * Generate FDM G-code from STL mesh.
 */
router.post('/fdm', async (req, res) => {
  try {
    const {
      jobId,
      meshType = 'mold',
      layerHeight,
      infillDensity,
      printSpeed,
      nozzleDiameter,
      filamentDiameter,
      bedTemp,
      hotendTemp,
    } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    // Get STL from Python service
    const stlBuffer = await bridge.exportSTL(jobId, meshType);

    // Save STL to temp file
    const tmpStlPath = path.join(os.tmpdir(), `molding_${jobId.slice(0, 8)}_${meshType}.stl`);
    fs.writeFileSync(tmpStlPath, Buffer.from(stlBuffer));

    try {
      const gcode = await GCodeGenerator.generateFDMGCode(tmpStlPath, {
        layerHeight: parseFloat(layerHeight || 0.2),
        infillDensity: parseInt(infillDensity || 20),
        printSpeed: parseInt(printSpeed || 60),
        nozzleDiameter: parseFloat(nozzleDiameter || 0.4),
        filamentDiameter: parseFloat(filamentDiameter || 1.75),
        bedTemp: parseInt(bedTemp || 60),
        hotendTemp: parseInt(hotendTemp || 200),
      });

      res.set({
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="fdm_${meshType}_${jobId.slice(0, 8)}.gcode"`,
      });

      res.send(gcode);
    } finally {
      // Cleanup temp file
      try { fs.unlinkSync(tmpStlPath); } catch {}
    }
  } catch (error) {
    console.error('FDM G-code error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
