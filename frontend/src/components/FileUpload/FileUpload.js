'use client';

import { useRef, useState } from 'react';
import styles from './FileUpload.module.css';

export default function FileUpload({ onImageReady }) {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFile = (file) => {
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PNG, JPEG, SVG, WebP, or BMP image.');
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  const useImage = () => {
    if (preview && onImageReady) {
      onImageReady(preview);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={styles.container}>
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ''} ${preview ? styles.hasPreview : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !preview && fileInputRef.current?.click()}
        id="drop-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp,image/bmp"
          onChange={handleInputChange}
          className={styles.fileInput}
          id="file-input"
        />

        {preview ? (
          <div className={styles.previewContainer}>
            <img src={preview} alt="Uploaded preview" className={styles.previewImage} />
            <div className={styles.previewOverlay}>
              <span className={styles.fileName}>{fileName}</span>
              <button className={styles.clearBtn} onClick={(e) => { e.stopPropagation(); clearPreview(); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.uploadIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className={styles.dropText}>Drop an image here or click to browse</p>
            <p className={styles.supportedFormats}>PNG, JPEG, SVG, WebP, BMP</p>
          </div>
        )}
      </div>

      {preview && (
        <button className={styles.useBtn} onClick={useImage} id="btn-use-upload">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>
          </svg>
          Use Image
        </button>
      )}
    </div>
  );
}
