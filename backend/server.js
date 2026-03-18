/**
 * Molding Backend Server
 * Express API server that orchestrates the Python geometry service
 * and G-code generation.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const processRoutes = require('./routes/process');
const exportRoutes = require('./routes/export');
const gcodeRoutes = require('./routes/gcode');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/process', processRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/gcode', gcodeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'molding-backend',
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`🔧 Molding Backend running on http://localhost:${PORT}`);
  console.log(`📡 Python service expected at ${process.env.PYTHON_SERVICE_URL || 'http://localhost:5001'}`);
});

module.exports = app;
