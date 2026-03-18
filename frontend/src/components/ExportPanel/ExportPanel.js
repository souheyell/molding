'use client';

import { useState } from 'react';
import MoldingAPI from '@/lib/api';
import styles from './ExportPanel.module.css';

export default function ExportPanel({ jobId, hasRelief, hasMold }) {
  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');

  const handleExport = async (type, action) => {
    if (!jobId) {
      setError('No job to export. Process an image first.');
      return;
    }

    setLoading({ ...loading, [type]: true });
    setError('');

    try {
      switch (type) {
        case 'stl-relief':
          await MoldingAPI.downloadSTL(jobId, 'relief');
          break;
        case 'stl-mold':
          await MoldingAPI.downloadSTL(jobId, 'mold');
          break;
        case 'gcode-laser':
          await MoldingAPI.downloadLaserGCode(jobId);
          break;
        case 'gcode-fdm':
          await MoldingAPI.downloadFDMGCode(jobId, { meshType: 'mold' });
          break;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading({ ...loading, [type]: false });
    }
  };

  const exports = [
    {
      id: 'stl-relief',
      title: 'Relief STL',
      description: 'Positive relief mesh',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      ),
      enabled: hasRelief,
      color: '#818cf8',
    },
    {
      id: 'stl-mold',
      title: 'Mold STL',
      description: 'Negative mold cavity',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 3v18"/><path d="M15 3v18"/>
          <path d="M3 9h18"/><path d="M3 15h18"/>
        </svg>
      ),
      enabled: hasMold,
      color: '#f97316',
    },
    {
      id: 'gcode-laser',
      title: 'Laser G-code',
      description: 'Raster engraving path',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="6"/>
          <circle cx="12" cy="12" r="2"/>
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
        </svg>
      ),
      enabled: hasRelief,
      color: '#22c55e',
    },
    {
      id: 'gcode-fdm',
      title: 'FDM G-code',
      description: '3D print slicer output',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 9l6 6 6-6"/>
          <path d="M6 5l6 6 6-6"/>
          <path d="M6 13l6 6 6-6"/>
        </svg>
      ),
      enabled: hasMold,
      color: '#eab308',
    },
  ];

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export
      </h3>

      {error && (
        <div className={styles.error}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </div>
      )}

      <div className={styles.exportGrid}>
        {exports.map(({ id, title, description, icon, enabled, color }) => (
          <button
            key={id}
            className={`${styles.exportCard} ${!enabled ? styles.disabled : ''}`}
            onClick={() => handleExport(id)}
            disabled={!enabled || loading[id]}
            id={`btn-export-${id}`}
            style={{ '--accent': color }}
          >
            <div className={styles.cardIcon}>{icon}</div>
            <div className={styles.cardContent}>
              <span className={styles.cardTitle}>{title}</span>
              <span className={styles.cardDesc}>{description}</span>
            </div>
            {loading[id] && <div className={styles.spinner} />}
          </button>
        ))}
      </div>
    </div>
  );
}
