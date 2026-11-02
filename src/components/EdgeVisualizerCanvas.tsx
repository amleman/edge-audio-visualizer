import React, { useEffect, useRef } from 'react';
import { AudioData, PALETTES, VisualizerSettings } from '../types';

interface EdgeVisualizerCanvasProps {
  settings: VisualizerSettings;
  audioData: AudioData;
  dominantColor?: string;
}

export const EdgeVisualizerCanvas: React.FC<EdgeVisualizerCanvasProps> = ({
  settings,
  audioData,
  dominantColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | 0>(0);
  const phaseRef = useRef<number>(0);
  // Picos (cyberpunk) y valores suavizados (minimal) por borde; se redimensionan según la cantidad de barras
  const peaksRef = useRef<{ [key: string]: number[] }>({});
  const smoothRef = useRef<{ [key: string]: number[] }>({});

  // El bucle de render lee siempre lo último desde refs, así no se reinicia en cada frame de audio
  const settingsRef = useRef(settings);
  const audioRef = useRef(audioData);
  const dominantColorRef = useRef(dominantColor);
  settingsRef.current = settings;
  audioRef.current = audioData;
  dominantColorRef.current = dominantColor;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const render = () => {
      const settings = settingsRef.current;
      const audioData = audioRef.current;
      const sensitivity = settings.sensitivity;
      const freqs = audioData.frequencies.length > 0 
        ? audioData.frequencies 
        : Array(64).fill(0);

      const bass = Math.min(1.0, audioData.bass * sensitivity);
      const treble = Math.min(1.0, audioData.treble * sensitivity);
      const volume = Math.min(1.0, audioData.volume * sensitivity);

      // La fase avanza con la velocidad base + un impulso con cada golpe de bajo
      phaseRef.current += (0.025 + bass * 0.05) * settings.speed;
      const phase = phaseRef.current;

      const thickness = settings.borderThickness;
      const colors = getActiveColors(settings, dominantColorRef.current, phase, bass);

      ctx.clearRect(0, 0, width, height);

      if (!settings.enabled) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      switch (settings.mode) {
        case 'neon-waves':
          renderNeonWaves(ctx, width, height, freqs, sensitivity, bass, treble, phase, colors, thickness, settings.borders, settings.glowIntensity, smoothRef.current);
          break;
        case 'ambilight-glow':
          renderAmbilightGlow(ctx, width, height, freqs, sensitivity, volume, bass, phase, colors, thickness, settings.borders, settings.glowIntensity, smoothRef.current);
          break;
        case 'cyberpunk-eq':
          renderCyberpunkEQ(ctx, width, height, freqs, sensitivity, colors, thickness, settings.borders, settings.glowIntensity, peaksRef.current, smoothRef.current);
          break;
        case 'minimal-eq':
          renderMinimalEQ(ctx, width, height, freqs, sensitivity, colors, thickness, settings.borders, smoothRef.current);
          break;
        case 'electric-plasma':
          renderElectricPlasma(ctx, width, height, freqs, bass, treble, phase, colors, thickness, settings.borders, settings.glowIntensity);
          break;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-50 bg-transparent"
    />
  );
};

function getActiveColors(
  settings: VisualizerSettings,
  dominantColor: string | undefined,
  phase: number,
  bass: number
): [string, string, string] {
  if (settings.colorPalette === 'rainbow') {
    // Rotación continua acelerada por el bajo. Luminosidad fija en 50% = color puro (más alto se vuelve pastel)
    const baseHue = (phase * 55 + bass * 180) % 360;
    const col1 = `hsl(${baseHue.toFixed(1)}, 100%, 50%)`;
    const col2 = `hsl(${((baseHue + 120) % 360).toFixed(1)}, 100%, 50%)`;
    const col3 = `hsl(${((baseHue + 240) % 360).toFixed(1)}, 100%, 50%)`;
    return [col1, col2, col3];
  }
  if (settings.colorPalette === 'custom') {
    return settings.customColors;
  }
  if (settings.colorPalette === 'album-art' && dominantColor) {
    return [dominantColor, '#00f0ff', '#ffffff'];
  }
  return PALETTES[settings.colorPalette]?.colors || PALETTES.rainbow.colors;
}

type Side = 'top' | 'bottom' | 'left' | 'right';

// Geometría común: "along" recorre el borde y "out" se aleja del borde hacia el centro de la pantalla
function edgeGeometry(w: number, h: number) {
  return {
    top: { length: w, toXY: (a: number, o: number): [number, number] => [a, o], seed: 0 },
    bottom: { length: w, toXY: (a: number, o: number): [number, number] => [a, h - o], seed: 1.7 },
    left: { length: h, toXY: (a: number, o: number): [number, number] => [o, a], seed: 3.1 },
    right: { length: h, toXY: (a: number, o: number): [number, number] => [w - o, a], seed: 4.6 },
  } as const;
}

// Rectángulo en coordenadas de pantalla a partir de (along, out, anchoAlong, largoOut)
function edgeRect(
  toXY: (a: number, o: number) => [number, number],
  a: number,
  o: number,
  aw: number,
  ol: number
): [number, number, number, number] {
  const [x1, y1] = toXY(a, o);
  const [x2, y2] = toXY(a + aw, o + ol);
  return [Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)];
}

// Degradado a lo largo del borde con los colores de la paleta (rotados según "shift")
function edgeGradient(
  ctx: CanvasRenderingContext2D,
  toXY: (a: number, o: number) => [number, number],
  length: number,
  colors: [string, string, string],
  shift: number
): CanvasGradient {
  const [x0, y0] = toXY(0, 0);
  const [x1, y1] = toXY(length, 0);
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, colors[shift % 3]);
  g.addColorStop(0.5, colors[(shift + 1) % 3]);
  g.addColorStop(1, colors[(shift + 2) % 3]);
  return g;
}

// ==========================================
// 1. MODO: NEON WAVES (HIPER REACTIVO)
// ==========================================
const WAVE_LAYERS = [
  { cycles: 3, speed: 1.0, amp: 1.0, width: 2.8, shift: 0 },
  { cycles: 5, speed: -1.5, amp: 0.68, width: 1.9, shift: 1 },
  { cycles: 9, speed: 2.3, amp: 0.4, width: 1.2, shift: 2 },
];

function renderNeonWaves(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  freqs: number[],
  sensitivity: number,
  bass: number,
  treble: number,
  phase: number,
  colors: [string, string, string],
  thickness: number,
  borders: VisualizerSettings['borders'],
  glowIntensity: number,
  state: { [key: string]: number[] }
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const geo = edgeGeometry(w, h);

  (Object.keys(geo) as Side[]).forEach((side) => {
    if (!borders[side]) return;
    const { length, toXY, seed } = geo[side];
    const n = Math.max(48, Math.round(length / 22));
    const energy = ensureLength(state, `wave-${side}`, n, 0);

    // Energía por punto suavizada en el tiempo: sube rápido, baja lento (sin temblores)
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const target = Math.min(1, sampleFreq(freqs, Math.abs(t - 0.5) * 1.6) * sensitivity);
      energy[i] += (target - energy[i]) * (target > energy[i] ? 0.35 : 0.07);
    }

    WAVE_LAYERS.forEach((layer, li) => {
      const pts: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        // Envolvente: la onda nace y muere en las esquinas para que los 4 bordes se unan limpio
        const env = Math.pow(Math.sin(t * Math.PI), 0.5);
        const osc = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * layer.cycles + phase * 2 * layer.speed + seed + li);
        const ripple = Math.sin(t * Math.PI * 40 - phase * 6) * treble * 0.12;
        const amp = thickness * (0.12 + energy[i] * 1.7 + bass * 0.45) * layer.amp;
        pts.push(toXY(t * length, 2 + env * amp * (osc + ripple)));
      }

      // Curva suave pasando por los puntos medios (sin esquinas quebradas)
      const tracePath = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last[0], last[1]);
      };

      const stroke = edgeGradient(ctx, toXY, length, colors, layer.shift);

      // Relleno translúcido entre el borde y la onda principal
      if (li === 0) {
        tracePath();
        const [ex, ey] = toXY(length, 0);
        const [sx, sy] = toXY(0, 0);
        ctx.lineTo(ex, ey);
        ctx.lineTo(sx, sy);
        ctx.closePath();
        ctx.globalAlpha = Math.min(0.35, (0.1 + bass * 0.15) * glowIntensity);
        ctx.fillStyle = stroke;
        ctx.fill();
      }

      tracePath();
      ctx.strokeStyle = stroke;
      const boost = 1 + bass * 0.9;
      // Halo en dos pasadas anchas de baja opacidad (más barato que shadowBlur en trazos largos)
      ctx.globalAlpha = Math.min(1, 0.07 * glowIntensity);
      ctx.lineWidth = layer.width * 7 * boost;
      ctx.stroke();
      ctx.globalAlpha = Math.min(1, 0.18 * glowIntensity);
      ctx.lineWidth = layer.width * 3.2 * boost;
      ctx.stroke();
      // Núcleo sólido
      ctx.globalAlpha = 1;
      ctx.lineWidth = layer.width * boost;
      ctx.stroke();
    });
  });

  ctx.restore();
}

// ==========================================
// 2. MODO: SCREEN AMBILIGHT / FLUID GLOW
// ==========================================
function renderAmbilightGlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  freqs: number[],
  sensitivity: number,
  volume: number,
  bass: number,
  phase: number,
  colors: [string, string, string],
  thickness: number,
  borders: VisualizerSettings['borders'],
  glowIntensity: number,
  state: { [key: string]: number[] }
) {
  ctx.save();
  const geo = edgeGeometry(w, h);
  const stops = colors.map(parseColor);

  (Object.keys(geo) as Side[]).forEach((side) => {
    if (!borders[side]) return;
    const { length, toXY, seed } = geo[side];
    const vertical = side === 'left' || side === 'right';

    // 1. Franja base pegada al borde que respira con el volumen: capas apiladas que se desvanecen hacia el centro
    const strip = thickness * (0.45 + volume * 0.6);
    const baseAlpha = Math.min(1, (0.45 + volume * 0.5) * glowIntensity);
    ctx.fillStyle = edgeGradient(ctx, toXY, length, colors, 0);
    const layers = 6;
    for (let k = 0; k < layers; k++) {
      const fadeK = 1 - k / layers;
      ctx.globalAlpha = baseAlpha * fadeK * fadeK * 0.45;
      ctx.fillRect(...edgeRect(toXY, 0, 0, length, strip * ((k + 1) / layers)));
    }

    // 2. Manchas de luz que flotan a lo largo del borde, cada una ligada a una banda de frecuencia
    const blobCount = Math.max(3, Math.round(length / 280));
    const energies = ensureLength(state, `glow-${side}`, blobCount, 0);
    ctx.globalAlpha = 1;
    for (let k = 0; k < blobCount; k++) {
      const drift = Math.sin(phase * 0.35 + k * 1.7 + seed) * 0.35;
      const t = Math.min(1, Math.max(0, (k + 0.5 + drift) / blobCount));
      const target = Math.min(1, sampleFreq(freqs, Math.abs(t - 0.5) * 1.6) * sensitivity * 0.8 + bass * 0.4);
      energies[k] += (target - energies[k]) * (target > energies[k] ? 0.25 : 0.05);
      const e = energies[k];

      const radius = thickness * (1.7 + e * 3.0);
      const [cr, cg, cb] = sampleGradient(stops, t).map((c) => c | 0);
      const alpha = Math.min(0.9, (0.28 + e * 0.7) * glowIntensity);
      const [cx, cy] = toXY(t * length, 0);

      // Elipse estirada a lo largo del borde
      ctx.save();
      ctx.translate(cx, cy);
      if (vertical) ctx.rotate(Math.PI / 2);
      ctx.scale(2.4, 1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${alpha})`);
      g.addColorStop(0.45, `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.4})`);
      g.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }
  });

  ctx.restore();
}

// ==========================================
// 3. MODO: CYBERPUNK EDGE EQ (BARRAS SEGMENTADAS TIPO LED)
// ==========================================
function renderCyberpunkEQ(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  freqs: number[],
  sensitivity: number,
  colors: [string, string, string],
  thickness: number,
  borders: VisualizerSettings['borders'],
  glowIntensity: number,
  peaks: { [key: string]: number[] },
  state: { [key: string]: number[] }
) {
  ctx.save();
  const maxBarLength = thickness * 2.5;
  const gap = 4;
  const segH = 5;
  const segGap = 2;
  const base = 3; // espacio reservado para la línea base
  const stops = colors.map(parseColor);
  const geo = edgeGeometry(w, h);

  (Object.keys(geo) as Side[]).forEach((side) => {
    if (!borders[side]) return;
    const { length, toXY } = geo[side];

    // Cantidad de barras proporcional al largo del borde (monitores ultrawide no quedan con barras gigantes)
    const barCount = Math.max(24, Math.round(length / 34));
    const barWidth = Math.max(3, (length - gap * (barCount - 1)) / barCount);
    const sidePeaks = ensureLength(peaks, side, barCount, 0);
    const values = ensureLength(state, `eq-${side}`, barCount, 0);

    // Línea base luminosa a lo largo del borde
    ctx.globalAlpha = 0.9;
    ctx.shadowBlur = 12 * glowIntensity;
    ctx.shadowColor = rgbString(stops[1]);
    ctx.fillStyle = edgeGradient(ctx, toXY, length, colors, 0);
    ctx.fillRect(...edgeRect(toXY, 0, 0, length, 2));

    for (let i = 0; i < barCount; i++) {
      const t = i / (barCount - 1);
      // Espejo: bajos en el centro del borde, agudos hacia las esquinas
      const target = Math.min(1.0, sampleFreq(freqs, Math.abs(t - 0.5) * 2) * sensitivity);
      values[i] += (target - values[i]) * (target > values[i] ? 0.55 : 0.14);
      const val = Math.max(0.03, values[i]);
      const segs = Math.max(1, Math.round((val * maxBarLength) / (segH + segGap)));

      // Picos flotantes con gravedad suave
      if (val >= sidePeaks[i]) {
        sidePeaks[i] = val;
      } else {
        sidePeaks[i] = Math.max(0.03, sidePeaks[i] - 0.008);
      }

      const color = rgbString(sampleGradient(stops, t));
      const a = i * (barWidth + gap);
      ctx.fillStyle = color;

      // Halo de la barra completa (una sola sombra por barra)
      ctx.shadowBlur = 14 * glowIntensity;
      ctx.shadowColor = color;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(...edgeRect(toXY, a, base, barWidth, segs * (segH + segGap)));

      // Segmentos LED: más tenues en la base y a pleno brillo en la punta
      ctx.shadowBlur = 0;
      for (let k = 0; k < segs; k++) {
        ctx.globalAlpha = 0.45 + 0.55 * ((k + 1) / segs);
        ctx.fillRect(...edgeRect(toXY, a, base + k * (segH + segGap), barWidth, segH));
      }

      // Pico flotante del mismo color con brillo
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 10 * glowIntensity;
      ctx.fillRect(...edgeRect(toXY, a, base + sidePeaks[i] * maxBarLength + 4, barWidth, 2.5));
    }
  });

  ctx.restore();
}

// ==========================================
// 3b. MODO: MINIMAL EQ (BARRITAS FINAS, SIN GLOW)
// ==========================================
function renderMinimalEQ(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  freqs: number[],
  sensitivity: number,
  colors: [string, string, string],
  thickness: number,
  borders: VisualizerSettings['borders'],
  smooth: { [key: string]: number[] }
) {
  ctx.save();
  const barWidth = 3;
  const gap = 5;
  const maxBarLength = thickness * 1.1;
  const stops = colors.map(parseColor);

  const drawBars = (
    totalLength: number,
    getRect: (pos: number, barH: number) => [number, number, number, number],
    side: 'top' | 'bottom' | 'left' | 'right'
  ) => {
    const barCount = Math.floor(totalLength / (barWidth + gap));
    const offset = (totalLength - barCount * (barWidth + gap) + gap) / 2;
    const values = ensureLength(smooth, side, barCount, 0);

    for (let i = 0; i < barCount; i++) {
      const t = i / (barCount - 1);
      // Espejo: los bajos en el centro del borde y los agudos hacia las esquinas
      const target = Math.min(1.0, sampleFreq(freqs, Math.abs(t - 0.5) * 2) * sensitivity);
      // Sube rápido y baja suave
      values[i] += (target - values[i]) * (target > values[i] ? 0.45 : 0.12);

      const barH = Math.max(2, values[i] * maxBarLength);
      ctx.fillStyle = rgbString(sampleGradient(stops, t));
      const [rx, ry, rw, rh] = getRect(offset + i * (barWidth + gap), barH);
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, barWidth / 2);
      ctx.fill();
    }
  };

  const m = 2; // separación mínima del borde físico
  if (borders.bottom) drawBars(w, (p, bh) => [p, h - bh - m, barWidth, bh], 'bottom');
  if (borders.top) drawBars(w, (p, bh) => [p, m, barWidth, bh], 'top');
  if (borders.left) drawBars(h, (p, bh) => [m, p, bh, barWidth], 'left');
  if (borders.right) drawBars(h, (p, bh) => [w - bh - m, p, bh, barWidth], 'right');

  ctx.restore();
}

// ==========================================
// 4. MODO NUEVO: ELECTRIC PLASMA & SPARKS ⚡ (REEMPLAZO DE VAPORWAVE)
// ==========================================
function renderElectricPlasma(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  freqs: number[],
  bass: number,
  treble: number,
  phase: number,
  colors: [string, string, string],
  thickness: number,
  borders: VisualizerSettings['borders'],
  glowIntensity: number
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowBlur = 20 * glowIntensity;

  const drawPlasmaBeam = (
    totalLen: number,
    getPoint: (pos: number, offset: number) => [number, number],
    color: string,
    sparkColor: string
  ) => {
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 + bass * 3.0;

    const segments = 60;
    ctx.beginPath();

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const fIdx = Math.floor(t * 35);
      const fEnergy = freqs[fIdx] || 0;

      // Generar rayo zig-zag eléctrico fractal modulado por agudos y bajos
      const noise = ((Math.sin(i * 13.5 + phase * 15) * 43758.5453) % 1) - 0.5;
      const arcOffset = (noise * 12 * (0.3 + treble * 1.5) + Math.sin(t * Math.PI * 4 + phase * 4) * 8) * (0.5 + bass);

      const [x, y] = getPoint(t * totalLen, Math.abs(arcOffset) + 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      // Si hay un pico de bajo (bass > 0.4), disparar chispas de plasma
      if (bass > 0.35 && i % 4 === 0) {
        ctx.save();
        ctx.strokeStyle = sparkColor;
        ctx.shadowColor = sparkColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const sparkLen = thickness * (0.5 + bass * 1.2) * (0.5 + fEnergy);
        const [sx, sy] = getPoint(t * totalLen, sparkLen);
        ctx.moveTo(x, y);
        ctx.lineTo(sx, sy);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.stroke();
  };

  if (borders.top) {
    drawPlasmaBeam(w, (x, off) => [x, off], colors[0], colors[1]);
  }
  if (borders.bottom) {
    drawPlasmaBeam(w, (x, off) => [x, h - off], colors[0], colors[1]);
  }
  if (borders.left) {
    drawPlasmaBeam(h, (y, off) => [off, y], colors[1], colors[2]);
  }
  if (borders.right) {
    drawPlasmaBeam(h, (y, off) => [w - off, y], colors[1], colors[2]);
  }

  ctx.restore();
}

// Muestrea el espectro con interpolación lineal; t 0..1 recorre los bins útiles (los últimos casi siempre están vacíos)
function sampleFreq(freqs: number[], t: number): number {
  const maxIdx = Math.min(freqs.length - 1, 47);
  const x = Math.min(1, Math.max(0, t)) * maxIdx;
  const i = Math.floor(x);
  const frac = x - i;
  return (freqs[i] || 0) * (1 - frac) + (freqs[Math.min(i + 1, maxIdx)] || 0) * frac;
}

function ensureLength(store: { [key: string]: number[] }, key: string, length: number, fill: number): number[] {
  if (!store[key] || store[key].length !== length) {
    store[key] = Array(length).fill(fill);
  }
  return store[key];
}

type Rgb = [number, number, number];

function sampleGradient(stops: Rgb[], t: number): Rgb {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  const mix: Rgb = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  // La mezcla lineal oscurece los tonos intermedios (rojo + verde = oliva); se restaura el brillo de los extremos
  const targetMax = Math.max(...a) * (1 - f) + Math.max(...b) * f;
  const mixMax = Math.max(...mix);
  if (mixMax <= 0) return mix;
  const k = targetMax / mixMax;
  return [Math.min(255, mix[0] * k), Math.min(255, mix[1] * k), Math.min(255, mix[2] * k)];
}

function rgbString([r, g, b]: Rgb): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function parseColor(color: string): Rgb {
  const hsl = color.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
  if (hsl) {
    const hh = parseFloat(hsl[1]) / 360;
    const ss = parseFloat(hsl[2]) / 100;
    const ll = parseFloat(hsl[3]) / 100;
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
    const p = 2 * ll - q;
    const hue = (tt: number) => {
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    return [hue(hh + 1 / 3) * 255, hue(hh) * 255, hue(hh - 1 / 3) * 255];
  }
  const rgb = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (rgb) return [parseFloat(rgb[1]), parseFloat(rgb[2]), parseFloat(rgb[3])];
  let c = color.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return [0, 240, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
