/**
 * Export Routes
 * Handles STL and heightmap exports.
 */

const express = require('express');
const { PythonBridge } = require('../services/pythonBridge');

const router = express.Router();
const bridge = new PythonBridge();

/**
 * POST /api/export/stl/:meshType
 * Export mesh as binary STL file.
 * meshType: 'relief' or 'mold'
 */
router.post('/stl/:meshType', async (req, res) => {
  try {
    const { meshType } = req.params;
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    if (!['relief', 'mold'].includes(meshType)) {
      return res.status(400).json({ error: "meshType must be 'relief' or 'mold'" });
    }

    const stlBuffer = await bridge.exportSTL(jobId, meshType);

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${meshType}_${jobId.slice(0, 8)}.stl"`,
    });

    res.send(Buffer.from(stlBuffer));
  } catch (error) {
    console.error('STL export error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/export/heightmap
 * Export heightmap data as JSON.
 */
router.post('/heightmap', async (req, res) => {
  try {
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const data = await bridge.exportHeightmap(jobId);
    res.json(data);
  } catch (error) {
    console.error('Heightmap export error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
