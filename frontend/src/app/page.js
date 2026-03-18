'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import DrawingCanvas from '@/components/Canvas/DrawingCanvas';
import FileUpload from '@/components/FileUpload/FileUpload';
import Controls from '@/components/Controls/Controls';
import ExportPanel from '@/components/ExportPanel/ExportPanel';
import MoldingAPI from '@/lib/api';
import { DEFAULTS } from '@/lib/constants';

// Dynamic import for Three.js (no SSR)
const Preview3D = dynamic(() => import('@/components/Preview3D/Preview3D'), {
  ssr: false,
  loading: () => (
    <div className="processingOverlay">
      <div className="processingSpinner" />
      <p className="processingText">Loading 3D viewer...</p>
    </div>
  ),
});

export default function Home() {
  const [inputMode, setInputMode] = useState('draw'); // 'draw' | 'upload'
  const [activeView, setActiveView] = useState('relief'); // 'relief' | 'mold'
  const [params, setParams] = useState(DEFAULTS);
  const [processing, setProcessing] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [heightmapPreview, setHeightmapPreview] = useState(null);
  const [reliefData, setReliefData] = useState(null);
  const [moldData, setMoldData] = useState(null);
  const [error, setError] = useState('');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [featureForm, setFeatureForm] = useState({ subject: '', message: '' });
  const [featureSent, setFeatureSent] = useState(false);

  // Check backend health
  useEffect(() => {
    const checkHealth = async () => {
      const ok = await MoldingAPI.healthCheck();
      setBackendStatus(ok ? 'online' : 'offline');
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleImageReady = useCallback((dataUrl) => {
    setImageData(dataUrl);
    setError('');
    // Auto-process when image is ready
    processImage(dataUrl);
  }, [params]);

  const processImage = async (dataUrl) => {
    if (!dataUrl) {
      setError('No image to process');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const result = await MoldingAPI.runFullPipeline(dataUrl, params);

      setJobId(result.job_id);
      setHeightmapPreview(result.preview);

      // Set relief data
      if (result.relief) {
        setReliefData({
          vertices: result.relief.vertices,
          faces: result.relief.faces,
          diagnostics: result.relief.diagnostics,
        });
      }

      // Set mold data
      if (result.mold) {
        setMoldData({
          vertices: result.mold.vertices,
          faces: result.mold.faces,
          diagnostics: result.mold.diagnostics,
        });
      }
    } catch (err) {
      setError(err.message || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const reprocess = () => {
    if (imageData) {
      processImage(imageData);
    }
  };

  const handleFeatureRequest = () => {
    const subject = encodeURIComponent(featureForm.subject || 'Molding Feature Request');
    const body = encodeURIComponent(
      `Feature Request for Molding App\n\n${featureForm.message}\n\n---\nSent from Molding BETA`
    );
    window.open(`mailto:souheyelh@gmail.com?subject=${subject}&body=${body}`, '_blank');
    setFeatureSent(true);
    setTimeout(() => {
      setShowFeatureModal(false);
      setFeatureForm({ subject: '', message: '' });
      setFeatureSent(false);
    }, 2000);
  };

  return (
    <div className="pageContainer">
      {/* Header */}
      <header className="header">
        <div className="headerLeft">
          <div className="logo">
            <div className="logoIcon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <span className="logoText">Molding</span>
            <span className="betaBadge">BETA</span>
          </div>
        </div>
        <div className="headerRight">
          <button
            className="featureRequestBtn"
            onClick={() => setShowFeatureModal(true)}
            id="btn-feature-request"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Request Feature
          </button>
          <div className="statusDot">
            <span
              className={`statusIndicator ${backendStatus !== 'online' ? 'offline' : ''}`}
            />
            {backendStatus === 'online' ? 'Connected' : backendStatus === 'checking' ? 'Connecting...' : 'Offline'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        {/* Left Panel — Input & Controls */}
        <div className="panelLeft">
          {/* Input Mode Tabs */}
          <div className="tabGroup">
            <button
              className={`tabBtn ${inputMode === 'draw' ? 'active' : ''}`}
              onClick={() => setInputMode('draw')}
              id="tab-draw"
            >
              ✏️ Draw
            </button>
            <button
              className={`tabBtn ${inputMode === 'upload' ? 'active' : ''}`}
              onClick={() => setInputMode('upload')}
              id="tab-upload"
            >
              📁 Upload
            </button>
          </div>

          {/* Input Area */}
          <div className="section">
            <div className="sectionTitle">
              <span className="sectionIcon">
                {inputMode === 'draw' ? '✏️' : '📁'}
              </span>
              {inputMode === 'draw' ? 'Canvas Drawing' : 'Image Upload'}
            </div>

            {inputMode === 'draw' ? (
              <DrawingCanvas onImageReady={handleImageReady} />
            ) : (
              <FileUpload onImageReady={handleImageReady} />
            )}
          </div>

          {/* Controls */}
          <div className="section">
            <Controls params={params} onChange={setParams} disabled={processing} />
          </div>

          {/* Reprocess button */}
          {imageData && (
            <button
              className={`processBtn ${processing ? 'processing' : ''}`}
              onClick={reprocess}
              disabled={processing || !imageData}
              id="btn-reprocess"
            >
              {processing ? (
                <>
                  <div className="processingSpinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  Processing...
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                  </svg>
                  Reprocess with New Settings
                </>
              )}
            </button>
          )}
        </div>

        {/* Center Panel — 3D Preview */}
        <div className="panelCenter">
          {/* View Mode Toggle */}
          <div className="viewToggle">
            <button
              className={`viewBtn ${activeView === 'relief' ? 'active' : ''}`}
              onClick={() => setActiveView('relief')}
              id="view-relief"
            >
              🏔️ Relief
            </button>
            <button
              className={`viewBtn ${activeView === 'mold' ? 'active' : ''}`}
              onClick={() => setActiveView('mold')}
              id="view-mold"
            >
              🧊 Mold
            </button>
          </div>

          {/* 3D Preview — always mounted to preserve WebGL context */}
          <Preview3D
            reliefData={reliefData}
            moldData={moldData}
            activeView={activeView}
            processing={processing}
          />

          {/* Heightmap Preview */}
          {heightmapPreview && (
            <div className="section">
              <div className="sectionTitle">
                <span className="sectionIcon">🗺️</span>
                Heightmap Preview
              </div>
              <div className="heightmapPreview">
                <img src={heightmapPreview} alt="Heightmap" />
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div style={{
              padding: '14px 18px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              color: '#ef4444',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* Right Panel — Export */}
        <div className="panelRight">
          <ExportPanel
            jobId={jobId}
            hasRelief={!!reliefData}
            hasMold={!!moldData}
          />

          {/* Info Panel */}
          <div className="section">
            <div className="sectionTitle">
              <span className="sectionIcon">ℹ️</span>
              Quick Guide
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>
              <p><strong style={{ color: 'rgba(255,255,255,0.8)' }}>1.</strong> Draw on the canvas or upload an image</p>
              <p><strong style={{ color: 'rgba(255,255,255,0.8)' }}>2.</strong> Adjust depth, resolution, and dimensions</p>
              <p><strong style={{ color: 'rgba(255,255,255,0.8)' }}>3.</strong> Preview the 3D relief and mold</p>
              <p><strong style={{ color: 'rgba(255,255,255,0.8)' }}>4.</strong> Export STL or G-code files</p>
            </div>
          </div>

          {/* Pipeline Info */}
          <div className="section">
            <div className="sectionTitle">
              <span className="sectionIcon">⚙️</span>
              Pipeline
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Grayscale', desc: 'Image → Heightmap', color: '#818cf8' },
                { label: 'Triangulate', desc: 'Grid mesh generation', color: '#06b6d4' },
                { label: 'Boolean', desc: 'Mold subtraction', color: '#f97316' },
                { label: 'Export', desc: 'STL + G-code output', color: '#22c55e' },
              ].map(({ label, desc, color }) => (
                <div key={label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  borderLeft: `3px solid ${color}`,
                }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="appFooter">
        <div className="footerContent">
          <span className="footerCopyright">
            © {new Date().getFullYear()} Souheyell. All rights reserved.
          </span>
          <span className="footerDivider">·</span>
          <span className="footerVersion">Molding BETA</span>
          <span className="footerDivider">·</span>
          <button
            className="footerLink"
            onClick={() => setShowFeatureModal(true)}
          >
            Request a Feature
          </button>
        </div>
      </footer>

      {/* Feature Request Modal */}
      {showFeatureModal && (
        <div className="modalOverlay" onClick={() => setShowFeatureModal(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h3 className="modalTitle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                Request a Feature
              </h3>
              <button className="modalClose" onClick={() => setShowFeatureModal(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {featureSent ? (
              <div className="modalSuccess">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p>Opening your email client...</p>
              </div>
            ) : (
              <div className="modalBody">
                <div className="modalField">
                  <label className="modalLabel" htmlFor="feature-subject">Subject</label>
                  <input
                    type="text"
                    id="feature-subject"
                    className="modalInput"
                    placeholder="e.g. Add SVG path editor"
                    value={featureForm.subject}
                    onChange={(e) => setFeatureForm(p => ({ ...p, subject: e.target.value }))}
                  />
                </div>
                <div className="modalField">
                  <label className="modalLabel" htmlFor="feature-message">Description</label>
                  <textarea
                    id="feature-message"
                    className="modalTextarea"
                    placeholder="Describe the feature you'd like to see..."
                    rows={5}
                    value={featureForm.message}
                    onChange={(e) => setFeatureForm(p => ({ ...p, message: e.target.value }))}
                  />
                </div>
                <button
                  className="modalSubmitBtn"
                  onClick={handleFeatureRequest}
                  disabled={!featureForm.message.trim()}
                  id="btn-submit-feature"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                  Send via Email
                </button>
                <p className="modalHint">
                  This will open your email client with a pre-filled message to the developer.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
