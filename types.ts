
export interface Point {
  x: number;
  y: number;
}

export interface MeasurementLine {
  start: Point;
  end: Point;
}

export enum CaptureView {
  PLANAR = 'PLANAR', // Top-down
  OBLIQUE = 'OBLIQUE' // Side-angle for depth
}

export interface TunnelingRecord {
  startClock: number;
  endClock: number;
  depthCm: number;
}

export interface UnderminingRecord {
  startClock: number;
  endClock: number;
  depthCm: number;
}

export interface CapturedImage {
  base64: string;
  view: CaptureView;
  orientation?: {
    beta: number; // Pitch
    gamma: number; // Roll
  };
}

export interface WoundAnalysisResult {
  lengthCm: number;
  widthCm: number;
  depthCm: number;
  areaCm2: number;
  lengthLine: MeasurementLine;
  widthLine: MeasurementLine;
  tunneling?: TunnelingRecord[];
  undermining?: UnderminingRecord[];
  tissueTypes: {
    epithelization: number;
    granulation: number;
    slough: number;
    eschar: number;
  };
  periWoundAppearance: string;
  clinicalNotes: string;
  skinToneObservation: string;
  accuracyConfidence: number;
  calibrationMethod: 'sticker' | 'dime' | 'ruler' | 'visual_estimation';
  markerDetected: boolean;
  // Learning Loop metadata
  isManualAdjustment?: boolean;
  originalValues?: {
    lengthCm: number;
    widthCm: number;
    depthCm: number;
  };
}

export interface AssessmentEntry {
  id: string;
  date: string;
  result: WoundAnalysisResult;
  images: CapturedImage[];
}

export interface Patient {
  id: string;
  name: string;
  assessments: AssessmentEntry[];
}

export enum AppState {
  HOME = 'HOME',
  CAMERA = 'CAMERA',
  STAGING = 'STAGING',
  ANALYZING = 'ANALYZING',
  RESULTS = 'RESULTS',
  HISTORY = 'HISTORY'
}
