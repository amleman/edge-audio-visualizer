import React, { useState } from 'react';
import { AudioData, MediaTrackInfo, VisualizerSettings } from '../types';
import { SlidersHorizontal, Settings2, Power } from 'lucide-react';

interface DynamicIslandProps {
  settings: VisualizerSettings;
  audioData: AudioData;
  mediaTrack: MediaTrackInfo | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onToggleEnabled: () => void;
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({
  settings,
  audioData,
  mediaTrack,
  isOpen,
  onToggleOpen,
  onToggleEnabled,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Determinar título inteligente: si no hay título pero hay sonido, decir "Reproduciendo Audio"
  const isAudioActive = audioData.volume > 0.015 || audioData.bass > 0.02;
  const trackTitle = mediaTrack?.title && mediaTrack.title !== 'Sin reproducción activa'
    ? mediaTrack.title
    : (isAudioActive ? 'Audio en Reproducción' : 'Edge Audio Visualizer');

  const trackArtist = mediaTrack?.artist && mediaTrack.artist !== 'Reproductor de Windows'
    ? mediaTrack.artist
    : (isAudioActive ? 'Salida de la PC' : 'En espera');

  const expanded = isHovered && !isOpen;
  // Curva tipo "spring" de iOS: arranca rápido y se asienta suave
  const ease = 'cubic-bezier(0.32, 0.72, 0, 1)';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onToggleOpen()}
      className={`fixed top-2.5 left-1/2 -translate-x-1/2 z-50 select-none cursor-pointer
        flex items-center justify-between overflow-hidden
        bg-black/90 backdrop-blur-2xl border border-white/15 shadow-xl shadow-black/80
        rounded-full text-slate-100 px-3.5 py-1.5
        ${expanded ? 'ring-1 ring-white/20' : ''}
        ${isOpen ? 'opacity-90' : 'opacity-100'}
      `}
      style={{
        width: isOpen ? 200 : expanded ? 400 : 260,
        transition: `width 500ms ${ease}, opacity 300ms ${ease}, box-shadow 300ms ${ease}`,
        willChange: 'width',
      }}
    >
      {/* 1. Lado Izquierdo: Micro Ecualizador Minimalista (3 barras ultra finas) */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="flex items-end gap-[2px] h-3.5 px-0.5">
          {[0.35, 0.9, 0.55].map((factor, idx) => {
            const scale = isAudioActive
              ? Math.min(1, Math.max(0.2, audioData.volume * factor + (audioData.frequencies[idx * 16] || 0) * 0.8))
              : 0.25;
            return (
              <div
                key={idx}
                className="w-[2px] h-full rounded-full bg-white/90 origin-bottom"
                // scaleY no provoca relayout (height sí) y la transición corta suaviza el salto entre frames de audio
                style={{ transform: `scaleY(${scale})`, transition: 'transform 90ms linear' }}
              />
            );
          })}
        </div>

        {/* Título de la música / audio */}
        <div className="min-w-0 flex-1 pr-1">
          <p className="text-[11px] font-medium text-slate-100 truncate leading-tight">
            {trackTitle}
          </p>
          {/* Siempre montado: se despliega con grid-rows en vez de aparecer de golpe */}
          <div
            className="grid"
            style={{
              gridTemplateRows: expanded ? '1fr' : '0fr',
              opacity: expanded ? 1 : 0,
              transition: `grid-template-rows 500ms ${ease}, opacity 350ms ${ease}`,
            }}
          >
            <p className="overflow-hidden text-[9px] text-slate-400 truncate leading-tight">
              <span className="block pt-0.5">{trackArtist}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 2. Lado Derecho: Controles Minimalistas */}
      <div className="flex items-center gap-1.5 pl-1.5 border-l border-white/10 shrink-0">
        {/* Toggle On/Off rápido: se desliza al hacer hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleEnabled();
          }}
          tabIndex={expanded ? 0 : -1}
          className={`rounded-full overflow-hidden flex items-center justify-center ${
            settings.enabled ? 'text-cyan-400 hover:text-cyan-300' : 'text-slate-500 hover:text-slate-400'
          }`}
          style={{
            width: expanded ? 20 : 0,
            height: 20,
            opacity: expanded ? 1 : 0,
            transform: `scale(${expanded ? 1 : 0.6})`,
            pointerEvents: expanded ? 'auto' : 'none',
            transition: `width 500ms ${ease}, opacity 300ms ${ease}, transform 400ms ${ease}`,
          }}
          title={settings.enabled ? 'Pausar Visualizador' : 'Activar Visualizador'}
        >
          <Power className="w-3 h-3 shrink-0" />
        </button>

        {/* Botón de Abrir Opciones */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleOpen();
          }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors duration-300 whitespace-nowrap ${
            isOpen
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
              : 'bg-white/10 text-slate-200 border-transparent hover:bg-white/20 hover:text-white'
          }`}
          title="Abrir panel de opciones y configuraciones"
        >
          {isOpen ? <Settings2 className="w-3 h-3 text-cyan-400" /> : <SlidersHorizontal className="w-3 h-3 text-slate-300" />}
          <span>{isOpen ? 'Cerrar' : 'Ajustes'}</span>
        </button>
      </div>
    </div>
  );
};
