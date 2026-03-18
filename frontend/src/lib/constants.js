export const DEFAULTS = {
  resolution: 256,
  depthMm: 10,
  widthMm: 100,
  heightMm: 100,
  baseThicknessMm: 2,
  wallThicknessMm: 5,
  floorThicknessMm: 3,
  blur: 1.0,
  invert: false,
  canvasWidth: 512,
  canvasHeight: 512,
};

export const SLIDER_RANGES = {
  resolution: { min: 32, max: 512, step: 32 },
  depthMm: { min: 1, max: 50, step: 0.5 },
  widthMm: { min: 10, max: 300, step: 5 },
  heightMm: { min: 10, max: 300, step: 5 },
  baseThicknessMm: { min: 0.5, max: 10, step: 0.5 },
  wallThicknessMm: { min: 1, max: 20, step: 0.5 },
  floorThicknessMm: { min: 1, max: 10, step: 0.5 },
  blur: { min: 0, max: 5, step: 0.1 },
};

export const LASER_DEFAULTS = {
  feedRate: 1000,
  maxPower: 1000,
  minPower: 0,
  pixelSize: 0.1,
  lineSpacing: 0.1,
  overscan: 2.0,
  bidirectional: true,
};

export const FDM_DEFAULTS = {
  layerHeight: 0.2,
  infillDensity: 20,
  printSpeed: 60,
  nozzleDiameter: 0.4,
  filamentDiameter: 1.75,
  bedTemp: 60,
  hotendTemp: 200,
};
