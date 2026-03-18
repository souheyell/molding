'use client';

import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import styles from './Preview3D.module.css';

function MeshObject({ vertices, faces, color = '#818cf8', wireframe = false }) {
  const meshRef = useRef();
  const geometry = useMemo(() => {
    if (!vertices || !faces || vertices.length === 0 || faces.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(vertices.flat());
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const indices = new Uint32Array(faces.flat());
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    geo.computeVertexNormals();
    geo.center();

    return geo;
  }, [vertices, faces]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color={color}
        metalness={0.3}
        roughness={0.6}
        side={THREE.DoubleSide}
        wireframe={wireframe}
      />
    </mesh>
  );
}

function SceneContent({ meshData, color, wireframe, autoRotate }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[50, 80, 50]} intensity={1.2} />
      <directionalLight position={[-30, 40, -30]} intensity={0.4} />
      <pointLight position={[0, 50, 0]} intensity={0.5} color="#818cf8" />

      {meshData?.vertices?.length > 0 && (
        <MeshObject
          vertices={meshData.vertices}
          faces={meshData.faces}
          color={color}
          wireframe={wireframe}
        />
      )}

      <Grid
        renderOrder={-1}
        position={[0, -50, 0]}
        infiniteGrid
        cellSize={10}
        cellThickness={0.4}
        sectionSize={50}
        sectionThickness={1}
        sectionColor="#6366f1"
        fadeDistance={300}
        fadeStrength={1}
      />

      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={1}
        enableDamping
        dampingFactor={0.05}
        minDistance={20}
        maxDistance={500}
      />
    </>
  );
}

export default function Preview3D({
  reliefData,
  moldData,
  activeView = 'relief',
  processing = false,
}) {
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  const meshData = activeView === 'mold' ? moldData : reliefData;
  const color = activeView === 'mold' ? '#f97316' : '#818cf8';
  const hasData = meshData?.vertices?.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.viewTabs}>
          <span className={`${styles.tab} ${activeView === 'relief' ? styles.activeTab : styles.inactiveTab}`}>
            Relief
          </span>
          <span className={`${styles.tab} ${activeView === 'mold' ? styles.activeTab : styles.inactiveTab}`}>
            Mold
          </span>
        </div>

        <div className={styles.controls}>
          <label className={styles.checkbox} htmlFor="toggle-wireframe">
            <input
              type="checkbox"
              id="toggle-wireframe"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
            />
            <span>Wireframe</span>
          </label>
          <label className={styles.checkbox} htmlFor="toggle-autorotate">
            <input
              type="checkbox"
              id="toggle-autorotate"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
            />
            <span>Auto-Rotate</span>
          </label>
        </div>
      </div>

      <div className={styles.canvasWrapper}>
        {/* Canvas is ALWAYS mounted — prevents WebGL context loss */}
        <Canvas
          camera={{ position: [150, 100, 150], fov: 45 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
          style={{ background: 'transparent' }}
          frameloop={hasData ? 'always' : 'demand'}
        >
          <SceneContent
            meshData={meshData}
            color={color}
            wireframe={wireframe}
            autoRotate={autoRotate}
          />
        </Canvas>

        {/* Overlay when no data or processing */}
        {(!hasData || processing) && (
          <div className={styles.overlayContainer}>
            {processing ? (
              <>
                <div className={styles.processingSpinner} />
                <p className={styles.placeholderText}>Generating geometry...</p>
              </>
            ) : (
              <>
                <div className={styles.placeholderIcon}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                </div>
                <p className={styles.placeholderText}>3D Preview</p>
                <p className={styles.placeholderHint}>Process an image to see the mesh</p>
              </>
            )}
          </div>
        )}
      </div>

      {hasData && meshData.diagnostics && (
        <div className={styles.diagnostics}>
          <div className={styles.diagItem}>
            <span className={styles.diagLabel}>Watertight</span>
            <span className={`${styles.diagBadge} ${meshData.diagnostics.is_watertight ? styles.badgeGreen : styles.badgeRed}`}>
              {meshData.diagnostics.is_watertight ? '✓' : '✗'}
            </span>
          </div>
          <div className={styles.diagItem}>
            <span className={styles.diagLabel}>Vertices</span>
            <span className={styles.diagValue}>{meshData.diagnostics.vertex_count?.toLocaleString()}</span>
          </div>
          <div className={styles.diagItem}>
            <span className={styles.diagLabel}>Faces</span>
            <span className={styles.diagValue}>{meshData.diagnostics.face_count?.toLocaleString()}</span>
          </div>
          {meshData.diagnostics.volume && (
            <div className={styles.diagItem}>
              <span className={styles.diagLabel}>Volume</span>
              <span className={styles.diagValue}>{meshData.diagnostics.volume.toFixed(1)} mm³</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
