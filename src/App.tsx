import { useState, useEffect } from 'react';
import { 
  AudioData, 
  MediaTrackInfo, 
  VisualizerSettings 
} from './types';
import { nativeBridge, NativeMessage } from './nativeBridge';
import { EdgeVisualizerCanvas } from './components/EdgeVisualizerCanvas';
import { DynamicIsland } from './components/DynamicIsland';
import { ControlCenter } from './components/ControlCenter';

export default function App() {
  const [settings, setSettings] = useState<VisualizerSettings>(() => {
    return nativeBridge.loadStoredSettings();
  });

  const [audioData, setAudioData] = useState<AudioData>({
    frequencies: Array(64).fill(0),
    bass: 0,
    mid: 0,
    treble: 0,
    volume: 0,
    isSilent: true,
  });

  const [mediaTrack, setMediaTrack] = useState<MediaTrackInfo | null>(null);

  const [isOverlayOnly] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mode') === 'overlay';
  });

  const [isControlOnly] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mode') === 'control';
  });

  // Estado de apertura del panel de opciones
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = nativeBridge.subscribe((msg: NativeMessage) => {
      if (msg.type === 'audio-frame') {
        setAudioData(msg.data);
      } else if (msg.type === 'media-track') {
        setMediaTrack(msg.data);
      } else if (msg.type === 'settings-update') {
        setSettings(msg.data);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateSettings = (newSettings: VisualizerSettings) => {
    setSettings(newSettings);
    nativeBridge.sendSettings(newSettings);
  };

  const handleToggleOptions = (open?: boolean) => {
    const nextState = open !== undefined ? open : !isOptionsOpen;
    setIsOptionsOpen(nextState);
    nativeBridge.setWindowExpanded(nextState);
  };

  // 1. Vista de solo overlay (ventana secundaria transparente a pantalla completa)
  if (isOverlayOnly) {
    return (
      <main 
        className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none select-none"
        style={{ background: 'transparent', backgroundColor: 'transparent' }}
      >
        <EdgeVisualizerCanvas
          settings={settings}
          audioData={audioData}
          dominantColor={mediaTrack?.dominantColor}
        />
      </main>
    );
  }

  // 2. Vista de solo panel de control (ventana nativa en Windows)
  if (isControlOnly) {
    return (
      <main className="w-screen h-screen relative overflow-hidden bg-transparent select-none">
        {/* Isla Dinámica Arriba en el Centro */}
        <DynamicIsland
          settings={settings}
          audioData={audioData}
          mediaTrack={mediaTrack}
          isOpen={isOptionsOpen}
          onToggleOpen={() => handleToggleOptions()}
          onToggleEnabled={() => handleUpdateSettings({ ...settings, enabled: !settings.enabled })}
        />

        {/* Panel de Opciones Flotante Arrastrable */}
        {isOptionsOpen && (
          <ControlCenter
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            audioData={audioData}
            mediaTrack={mediaTrack}
            onClose={() => handleToggleOptions(false)}
          />
        )}
      </main>
    );
  }

  // 3. Vista combinada (ideal para navegador http://localhost:1420)
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 flex flex-col items-center justify-center">
      {/* Visualizador de fondo reactivo a los bordes */}
      <EdgeVisualizerCanvas
        settings={settings}
        audioData={audioData}
        dominantColor={mediaTrack?.dominantColor}
      />

      {/* Isla Dinámica Arriba en el Centro */}
      <DynamicIsland
        settings={settings}
        audioData={audioData}
        mediaTrack={mediaTrack}
        isOpen={isOptionsOpen}
        onToggleOpen={() => handleToggleOptions()}
        onToggleEnabled={() => handleUpdateSettings({ ...settings, enabled: !settings.enabled })}
      />

      {/* Panel de Opciones Flotante Arrastrable */}
      {isOptionsOpen && (
        <ControlCenter
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          audioData={audioData}
          mediaTrack={mediaTrack}
          onClose={() => handleToggleOptions(false)}
        />
      )}
    </main>
  );
}
