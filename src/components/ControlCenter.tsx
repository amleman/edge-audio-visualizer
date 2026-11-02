import React, { useState, useRef, useEffect } from 'react';
import { 
  AudioData, 
  MediaTrackInfo, 
  VisualizerSettings, 
  VisualizerMode, 
  ColorPalette, 
  PALETTES 
} from '../types';
import { 
  Activity, 
  Sliders, 
  Zap, 
  Music, 
  Power, 
  Sparkles, 
  Minimize2, 
  X, 
  Waves, 
  SunMedium, 
  BarChart3, 
  GripHorizontal,
  Mic,
  Volume2
} from 'lucide-react';
import { nativeBridge } from '../nativeBridge';

interface ControlCenterProps {
  settings: VisualizerSettings;
  onUpdateSettings: (newSettings: VisualizerSettings) => void;
  audioData: AudioData;
  mediaTrack: MediaTrackInfo | null;
  onClose?: () => void;
}

export const ControlCenter: React.FC<ControlCenterProps> = ({
  settings,
  onUpdateSettings,
  audioData,
  mediaTrack,
  onClose,
}) => {
  const [usingMic, setUsingMic] = useState(false);

  // Estado para arrastrar libremente el panel a cualquier lugar
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    // Posición inicial centrada y justo debajo de la Isla Dinámica
    const initialX = Math.max(10, (window.innerWidth - 640) / 2);
    const initialY = 56;
    return { x: initialX, y: initialY };
  });

  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    nativeBridge.startNativeDrag();
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newX = Math.max(10, Math.min(window.innerWidth - 600, e.clientX - dragOffsetRef.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 300, e.clientY - dragOffsetRef.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const update = (partial: Partial<VisualizerSettings>) => {
    const updated = { ...settings, ...partial };
    onUpdateSettings(updated);
  };

  const toggleBorder = (side: keyof VisualizerSettings['borders']) => {
    update({
      borders: {
        ...settings.borders,
        [side]: !settings.borders[side],
      },
    });
  };

  const setAllBorders = (active: boolean) => {
    update({
      borders: {
        top: active,
        bottom: active,
        left: active,
        right: active,
      },
    });
  };

  const handleToggleMic = async () => {
    const active = await nativeBridge.toggleMicrophone();
    setUsingMic(active);
  };

  const modes: { id: VisualizerMode; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: 'neon-waves',
      label: 'Neon Waves (Hiper-Reactivo)',
      desc: 'Ondas sinusoidales dinámicas que aceleran y vibran con cada golpe de bombo y platillo',
      icon: <Waves className="w-5 h-5 text-cyan-400" />,
    },
    {
      id: 'ambilight-glow',
      label: 'Fluid Glow (Ambilight)',
      desc: 'Resplandor ambiental suave y atmosférico que respira con el beat en los bordes',
      icon: <SunMedium className="w-5 h-5 text-amber-400" />,
    },
    {
      id: 'cyberpunk-eq',
      label: 'Cyberpunk EQ (Colores Vivos)',
      desc: 'Barras de ecualizador con picos flotantes y colores ultra brillantes sin saturar',
      icon: <BarChart3 className="w-5 h-5 text-pink-500" />,
    },
    {
      id: 'minimal-eq',
      label: 'Minimal EQ',
      desc: 'Barritas finas y redondeadas sin resplandor, con los bajos al centro de cada borde',
      icon: <Activity className="w-5 h-5 text-slate-200" />,
    },
    {
      id: 'electric-plasma',
      label: 'Electric Plasma ⚡',
      desc: 'Rayo de plasma y arcos eléctricos de energía que chisporrotean al ritmo de la música',
      icon: <Zap className="w-5 h-5 text-yellow-400" />,
    },
  ];

  return (
    <div 
      className="fixed z-50 w-full max-w-[640px] bg-slate-950/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden select-none transition-shadow duration-300"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* Barra superior ARRASTRABLE (Header Draggable) */}
      <div 
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-900/70 cursor-move hover:bg-slate-900/90 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <GripHorizontal className="w-4 h-4 text-slate-500" />
          <div className="relative">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            {audioData.volume > 0.05 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <div>
            <h1 className="text-xs font-semibold tracking-wide bg-gradient-to-r from-cyan-400 via-sky-300 to-fuchsia-400 bg-clip-text text-transparent">
              Edge Audio Visualizer • Panel Flotante
            </h1>
            <p className="text-[9px] text-slate-400">Arrastra desde aquí para mover el panel</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
          {/* Master Toggle */}
          <button
            onClick={() => update({ enabled: !settings.enabled })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              settings.enabled
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <Power className="w-3 h-3" />
            {settings.enabled ? 'Activo' : 'Pausado'}
          </button>

          <button
            onClick={() => nativeBridge.minimizeToTray()}
            title="Minimizar a bandeja"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              title="Cerrar opciones (volver a Isla Dinámica)"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
        {/* Tarjeta Now Playing */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800/90 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-3.5">
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700/60 shadow-inner">
              {mediaTrack?.thumbnailUrl ? (
                <img
                  src={mediaTrack.thumbnailUrl}
                  alt="Album Art"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music className="w-6 h-6 text-cyan-400/80" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-400 border border-cyan-800/50">
                  {nativeBridge.isNative ? 'Audio Windows (WASAPI)' : (usingMic ? 'Micrófono Web' : 'Simulación Rítmica')}
                </span>
                {mediaTrack?.isPlaying && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    En vivo
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-100 truncate mt-1">
                {mediaTrack?.title || 'Esperando sonido en Windows...'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {mediaTrack?.artist ? `${mediaTrack.artist} ${mediaTrack.album ? `• ${mediaTrack.album}` : ''}` : 'Captura de audio activa'}
              </p>
            </div>

            {!nativeBridge.isNative && (
              <button
                onClick={handleToggleMic}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  usingMic
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-md shadow-rose-950/40'
                    : 'bg-slate-800/80 text-cyan-400 border-slate-700 hover:bg-slate-800'
                }`}
                title="Capturar sonido con el micrófono en el navegador"
              >
                {usingMic ? <Mic className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {usingMic ? 'Audio Real' : 'Micrófono'}
              </button>
            )}

            {/* Medidor VU en vivo */}
            <div className="flex items-end gap-1 h-7 px-2">
              {[0.2, 0.45, 0.75, 0.5, 0.85, 0.35].map((factor, idx) => {
                const h = Math.min(100, Math.max(12, (audioData.volume * factor + (audioData.frequencies[idx * 7] || 0) * 0.75) * 100));
                return (
                  <div
                    key={idx}
                    className="w-1.5 rounded-t bg-gradient-to-t from-cyan-400 via-fuchsia-400 to-amber-300 transition-all duration-75"
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* 1. Selector de Modos Visuales */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Modos de Visualización
          </label>
          <div className="grid grid-cols-2 gap-2">
            {modes.map((m) => {
              const active = settings.mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => update({ mode: m.id })}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    active
                      ? 'bg-slate-800/95 border-cyan-400/80 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-400/40'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {m.icon}
                    <span className={`text-xs font-semibold ${active ? 'text-cyan-300' : 'text-slate-200'}`}>
                      {m.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Configuración de Bordes Activos */}
        <div className="p-3.5 rounded-xl border border-slate-800/90 bg-slate-900/40">
          <div className="flex items-center justify-between mb-2.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Bordes de la Pantalla Activos
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAllBorders(true)}
                className="text-[10px] text-cyan-400 hover:underline"
              >
                Todos
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={() => {
                  update({ borders: { top: false, bottom: true, left: false, right: false } });
                }}
                className="text-[10px] text-slate-400 hover:text-slate-200 hover:underline"
              >
                Solo Inferior
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => {
              const active = settings.borders[side];
              const labels: Record<string, string> = {
                top: 'Superior (Arriba)',
                bottom: 'Inferior (Abajo)',
                left: 'Izquierda',
                right: 'Derecha',
              };
              return (
                <button
                  key={side}
                  onClick={() => toggleBorder(side)}
                  className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                    active
                      ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-300 font-semibold shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-500 hover:text-slate-400'
                  }`}
                >
                  <div className="text-[9px] uppercase tracking-wider">{side}</div>
                  <div className="text-[11px] font-medium">{labels[side]}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Sliders de Calibración */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-medium text-slate-300">Grosor Borde</span>
              <span className="text-[10px] font-mono text-cyan-400">{settings.borderThickness}px</span>
            </div>
            <input
              type="range"
              min="10"
              max="70"
              step="2"
              value={settings.borderThickness}
              onChange={(e) => update({ borderThickness: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-medium text-slate-300">Sensibilidad</span>
              <span className="text-[10px] font-mono text-cyan-400">{settings.sensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              value={settings.sensitivity}
              onChange={(e) => update({ sensitivity: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>

          <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-medium text-slate-300">Intensidad Glow</span>
              <span className="text-[10px] font-mono text-cyan-400">{settings.glowIntensity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.2"
              step="0.1"
              value={settings.glowIntensity}
              onChange={(e) => update({ glowIntensity: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
          </div>
        </div>

        {/* 4. Paleta de Colores ULTRA VIVOS */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Paletas de Color (Vibrantes & Neón)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PALETTES) as ColorPalette[]).map((palKey) => {
              const pal = PALETTES[palKey];
              const active = settings.colorPalette === palKey;
              return (
                <button
                  key={palKey}
                  onClick={() => update({ colorPalette: palKey })}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                    active
                      ? 'bg-slate-800/95 border-cyan-400/80 shadow-md ring-1 ring-cyan-400/40'
                      : 'bg-slate-900/50 border-slate-800/70 hover:bg-slate-800/50'
                  }`}
                >
                  <span className={`text-[11px] font-medium ${active ? 'text-cyan-300 font-semibold' : 'text-slate-300'}`}>
                    {pal.name}
                  </span>
                  <div className="flex -space-x-1">
                    {pal.colors.map((c, idx) => (
                      <span
                        key={idx}
                        className="w-3.5 h-3.5 rounded-full border border-slate-900 shadow-sm"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {settings.colorPalette === 'custom' && (
            <div className="mt-2.5 p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-300">Colores Personalizados Neón:</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.customColors[0]}
                  onChange={(e) =>
                    update({
                      customColors: [e.target.value, settings.customColors[1], settings.customColors[2]],
                    })
                  }
                  className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                />
                <input
                  type="color"
                  value={settings.customColors[1]}
                  onChange={(e) =>
                    update({
                      customColors: [settings.customColors[0], e.target.value, settings.customColors[2]],
                    })
                  }
                  className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                />
                <input
                  type="color"
                  value={settings.customColors[2]}
                  onChange={(e) =>
                    update({
                      customColors: [settings.customColors[0], settings.customColors[1], e.target.value],
                    })
                  }
                  className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
