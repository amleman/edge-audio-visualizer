export type VisualizerMode = 
  | 'neon-waves' 
  | 'ambilight-glow' 
  | 'cyberpunk-eq' 
  | 'minimal-eq'
  | 'electric-plasma';

export interface ActiveBorders {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export type ColorPalette = 
  | 'rainbow'
  | 'cyberpunk' 
  | 'synthwave' 
  | 'matrix' 
  | 'electric-blue' 
  | 'pure-rgb'
  | 'solid-red'
  | 'solid-blue'
  | 'solid-green'
  | 'solid-purple'
  | 'solid-white'
  | 'album-art' 
  | 'custom';

export interface VisualizerSettings {
  mode: VisualizerMode;
  borders: ActiveBorders;
  borderThickness: number; // en píxeles (e.g. 10 - 70)
  sensitivity: number;     // multiplicador (0.5 - 3.0)
  smoothing: number;       // decay smoothing (0.1 - 0.95)
  speed: number;           // velocidad animación (0.5 - 2.5)
  colorPalette: ColorPalette;
  customColors: [string, string, string];
  glowIntensity: number;   // 0.2 - 2.0
  enabled: boolean;
}

export interface AudioData {
  frequencies: number[]; // 64 valores normalizados 0.0 - 1.0
  bass: number;          // 0.0 - 1.0
  mid: number;           // 0.0 - 1.0
  treble: number;        // 0.0 - 1.0
  volume: number;        // 0.0 - 1.0
  isSilent: boolean;
}

export interface MediaTrackInfo {
  title: string;
  artist: string;
  album: string;
  thumbnailUrl: string | null;
  isPlaying: boolean;
  dominantColor?: string;
}

export const DEFAULT_SETTINGS: VisualizerSettings = {
  mode: 'neon-waves',
  borders: {
    top: true,
    bottom: true,
    left: true,
    right: true,
  },
  borderThickness: 32,
  sensitivity: 1.0,
  smoothing: 0.8,
  speed: 1.0,
  colorPalette: 'rainbow',
  customColors: ['#00f0ff', '#ff007f', '#ffe600'],
  glowIntensity: 1.3,
  enabled: true,
};

// Colores ULTRA VIVOS y saturados (nada de tonos pastel)
export const PALETTES: Record<ColorPalette, { name: string; colors: [string, string, string] }> = {
  rainbow: {
    name: 'Dynamic Rainbow 🌈',
    colors: ['#ff0055', '#00ffcc', '#ffe600'],
  },
  cyberpunk: {
    name: 'Cyberpunk Hyper-Neon',
    colors: ['#00f0ff', '#ff0077', '#9900ff'],
  },
  synthwave: {
    name: 'Synthwave Fire',
    colors: ['#ff3300', '#ff0066', '#ffcc00'],
  },
  matrix: {
    name: 'Matrix Laser Green',
    colors: ['#00ff66', '#00ffcc', '#003300'],
  },
  'electric-blue': {
    name: 'Electric Blue & Gold',
    colors: ['#00e5ff', '#0055ff', '#ffbb00'],
  },
  // Colores sólidos: tonos puros (luminosidad 50%) o de un solo color, sin mezcla con blanco
  'pure-rgb': {
    name: 'RGB Puro',
    colors: ['#ff0000', '#00ff00', '#0000ff'],
  },
  'solid-red': {
    name: 'Rojo Sólido',
    colors: ['#ff0000', '#ff1a00', '#ff0000'],
  },
  'solid-blue': {
    name: 'Azul Sólido',
    colors: ['#0040ff', '#0066ff', '#0040ff'],
  },
  'solid-green': {
    name: 'Verde Sólido',
    colors: ['#00e600', '#00ff22', '#00e600'],
  },
  'solid-purple': {
    name: 'Morado Sólido',
    colors: ['#8000ff', '#a000ff', '#8000ff'],
  },
  'solid-white': {
    name: 'Blanco Puro',
    colors: ['#ffffff', '#ffffff', '#ffffff'],
  },
  'album-art': {
    name: 'Music Reactive Art',
    colors: ['#00f0ff', '#ff0077', '#ffbb00'],
  },
  custom: {
    name: 'Personalizado',
    colors: ['#00f0ff', '#ff0077', '#ffe600'],
  },
};
