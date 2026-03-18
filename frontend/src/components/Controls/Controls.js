'use client';

import styles from './Controls.module.css';
import { SLIDER_RANGES } from '@/lib/constants';

export default function Controls({ params, onChange, disabled = false }) {
  const handleChange = (key, value) => {
    onChange({ ...params, [key]: value });
  };

  const sliders = [
    { key: 'resolution', label: 'Resolution', unit: 'px', icon: '⊞' },
    { key: 'depthMm', label: 'Relief Depth', unit: 'mm', icon: '↕' },
    { key: 'widthMm', label: 'Width', unit: 'mm', icon: '↔' },
    { key: 'heightMm', label: 'Height', unit: 'mm', icon: '↕' },
    { key: 'baseThicknessMm', label: 'Base Thickness', unit: 'mm', icon: '▬' },
    { key: 'wallThicknessMm', label: 'Wall Thickness', unit: 'mm', icon: '▐' },
    { key: 'floorThicknessMm', label: 'Floor Thickness', unit: 'mm', icon: '▄' },
    { key: 'blur', label: 'Smoothing', unit: '', icon: '◌' },
  ];

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        Parameters
      </h3>

      <div className={styles.toggleGroup}>
        <label className={styles.toggle} htmlFor="toggle-invert">
          <span className={styles.toggleLabel}>Invert Heightmap</span>
          <input
            type="checkbox"
            id="toggle-invert"
            checked={params.invert || false}
            onChange={(e) => handleChange('invert', e.target.checked)}
            disabled={disabled}
          />
          <span className={styles.toggleSwitch} />
        </label>
      </div>

      <div className={styles.sliders}>
        {sliders.map(({ key, label, unit, icon }) => {
          const range = SLIDER_RANGES[key];
          if (!range) return null;
          return (
            <div key={key} className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderIcon}>{icon}</span>
                <span className={styles.sliderLabel}>{label}</span>
                <span className={styles.sliderValue}>
                  {params[key]}{unit && <span className={styles.unit}>{unit}</span>}
                </span>
              </div>
              <input
                type="range"
                id={`slider-${key}`}
                min={range.min}
                max={range.max}
                step={range.step}
                value={params[key] || range.min}
                onChange={(e) => handleChange(key, parseFloat(e.target.value))}
                disabled={disabled}
                className={styles.slider}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
