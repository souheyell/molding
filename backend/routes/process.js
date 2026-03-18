/**
 * Process Routes
 * Handles the geometry processing pipeline: heightmap → mesh → mold.
 */

const express = require('express');
const multer = require('multer');
const { PythonBridge } = require('../services/pythonBridge');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const bridge = new PythonBridge();

/**
 * POST /api/process/heightmap
 * Generate a heightmap from uploaded image or base64 data.
 */
router.post('/heightmap', upload.single('file'), async (req, res) => {
  try {
    const options = {
      resolution: parseInt(req.body.resolution || req.query.resolution || '256'),
      invert: (req.body.invert || req.query.invert || 'false') === 'true',
      blur: parseFloat(req.body.blur || req.query.blur || '1.0'),
    };

    let result;
    if (req.file) {
      result = await bridge.generateHeightmapFromFile(req.file.buffer, req.file.originalname, options);
    } else if (req.body.image) {
      result = await bridge.generateHeightmap(req.body.image, options);
    } else {
      return res.status(400).json({ error: 'No image provided. Upload a file or send base64 image data.' });
    }

    res.json(result);
  } catch (error) {
    console.error('Heightmap error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/process/mesh
 * Generate a 3D mesh from an existing heightmap job.
 */
router.post('/mesh', async (req, res) => {
  try {
    const { jobId, depthMm, widthMm, heightMm, baseThicknessMm } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const result = await bridge.generateMesh(jobId, {
      depthMm: parseFloat(depthMm || 10),
      widthMm: parseFloat(widthMm || 100),
      heightMm: parseFloat(heightMm || 100),
      baseThicknessMm: parseFloat(baseThicknessMm || 2),
    });

    res.json(result);
  } catch (error) {
    console.error('Mesh error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/process/mold
 * Generate a negative mold from an existing mesh.
 */
router.post('/mold', async (req, res) => {
  try {
    const { jobId, wallThicknessMm, floorThicknessMm } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const result = await bridge.generateMold(jobId, {
      wallThicknessMm: parseFloat(wallThicknessMm || 5),
      floorThicknessMm: parseFloat(floorThicknessMm || 3),
    });

    res.json(result);
  } catch (error) {
    console.error('Mold error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/process/full
 * Run the complete pipeline: image → heightmap → mesh → mold.
 */
router.post('/full', upload.single('file'), async (req, res) => {
  try {
    let imageBase64;

    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      const mime = req.file.mimetype || 'image/png';
      imageBase64 = `data:${mime};base64,${base64}`;
    } else if (req.body.image) {
      imageBase64 = req.body.image;
    } else {
      return res.status(400).json({ error: 'No image provided' });
    }

    const options = {
      resolution: parseInt(req.body.resolution || '256'),
      invert: (req.body.invert || 'false') === 'true',
      blur: parseFloat(req.body.blur || '1.0'),
      depthMm: parseFloat(req.body.depthMm || '10'),
      widthMm: parseFloat(req.body.widthMm || '100'),
      heightMm: parseFloat(req.body.heightMm || '100'),
      baseThicknessMm: parseFloat(req.body.baseThicknessMm || '2'),
      wallThicknessMm: parseFloat(req.body.wallThicknessMm || '5'),
      floorThicknessMm: parseFloat(req.body.floorThicknessMm || '3'),
    };

    const result = await bridge.fullPipeline(imageBase64, options);
    res.json(result);
  } catch (error) {
    console.error('Full pipeline error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
