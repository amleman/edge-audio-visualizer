# Contexto del Proyecto: Edge Audio Visualizer (PC / Windows)

Documento técnico integral con la arquitectura, plan de desarrollo, decisiones de ingeniería, estado actual del sistema, errores encontrados y soluciones aplicadas.

---

## 1. Resumen y Propósito del Proyecto

**Edge Audio Visualizer** es una aplicación de escritorio para Windows 10 y 11 diseñada para proyectar efectos visuales de audio hiper-reactivos a lo largo de los cuatro bordes del monitor (pantalla completa o márgenes seleccionados):
- **Always On Top & Click-Through Total:** Siempre visible por encima de cualquier videojuego, navegador o aplicación de productividad, pero 100% intangible para el ratón mediante estilos Win32 (`WS_EX_TRANSPARENT`). Los clics del usuario nunca son bloqueados y pasan directo a las aplicaciones de fondo.
- **Isla Dinámica Superior (Dynamic Island):** Una cápsula compacta y ultra-minimalista ubicada arriba en el centro que muestra en tiempo real la canción/video que suena en la PC (Spotify, YouTube en Chrome/Edge, etc.) con micro-vúmetro reactivo, y que al hacer clic despliega un panel de ajustes flotante arrastrable.
- **Rendimiento de Grado Gaming:** Consumo imperceptible de CPU/GPU (latencia de captura < 5ms mediante WASAPI Loopback, renderizado por hardware a 60-144 FPS).
- **Doble Entorno:** Funciona como aplicación de escritorio nativa de Windows (.NET 10 + WebView2) y también como aplicación web autónoma en navegador para pruebas rápidas con la Web Audio API.

---

## 2. Stack Tecnológico

| Capa | Tecnologías | Justificación |
| :--- | :--- | :--- |
| **Backend / Host Nativo** | **C# / .NET 10** (WPF + WinRT Windows 10/11) | Acceso nativo y sin latencia a las APIs de bajo nivel de Windows sin dependencias externas complejas de C++. |
| **Captura de Audio** | **NAudio (WASAPI Loopback)** | Captura directa del buffer de salida de audio del sistema operativo sin requerir cables virtuales (VB-Cable) ni drivers de terceros. |
| **Análisis de Señal (DSP)** | **FFT Radix-2 Cooley-Tukey (1024 puntos, ventana Hann)** | Cálculo espectral de 64 bandas logarítmicas a 60 FPS con decaimiento suave y normalización perceptual gamma. |
| **Detección Multimedia** | **Windows System Media Transport Controls (SMTC)** | Conexión con `GlobalSystemMediaTransportControlsSessionManager` para extraer título, artista y carátula de reproductores activos. |
| **Capa de Presentación Web** | **Microsoft.Web.WebView2 (Chromium)** | Renderizado con canal alfa transparente acelerado por hardware e interoperabilidad bidireccional IPC. El overlay usa el control `WebView2` clásico; la ventana interactiva usa `WebView2CompositionControl` (ver Error 9). |
| **Frontend UI & Canvas** | **React 19 + TypeScript + Vite 8** | Modularidad de componentes reactivos y tipado estricto. |
| **Estilos y Diseño** | **Tailwind CSS v4 + Lucide Icons** | Diseño cyberpunk, glassmorphic y dark-mode minimalista. |
| **Motor Gráfico** | **HTML5 Canvas 2D acelerado por GPU** | Renderizado a 60-144 FPS con composiciones luminosas (`lighter`, `screen`, `shadowBlur`). |

---

## 3. Arquitectura del Sistema

El software utiliza un modelo desacoplado de dos ventanas sincronizadas por eventos IPC:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SISTEMA OPERATIVO WINDOWS                       │
│  WASAPI Audio Stream              Windows Media Controls (SMTC)        │
└───────────────┬──────────────────────────────────┬─────────────────────┘
                │                                  │
                ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       HOST C# (.NET 10 - WPF)                          │
│                                                                        │
│   AudioEngine.cs                                MediaTracker.cs        │
│   - Captura Loopback PCM Float                  - Escaneo GetSessions()│
│   - FFT Radix-2 + Ventana Hann                  - Detección YouTube/App│
│   - 64 bandas logarítmicas (Bass/Mid/Treble)    - Fallback de audio    │
│                                                                        │
│           │ DispatcherTimer (60 FPS)                     │ Eventos     │
│           ▼                                              ▼             │
│   PostWebMessageAsJson("audio-frame")       PostWebMessageAsJson("track")│
└───────────────┬──────────────────────────────────┬─────────────────────┘
                │                                  │
       ┌────────┴──────────────┐          ┌────────┴─────────────┐
       ▼                       ▼          ▼                      ▼
┌─────────────────────────────┐        ┌───────────────────────────────┐
│     VENTANA 1: OVERLAY      │        │      VENTANA 2: CONTROL       │
│  (OverlayWindow.xaml)       │        │     (MainWindow.xaml)         │
│  - Pantalla Completa        │        │  - Tamaño Adaptativo:         │
│  - WS_EX_TRANSPARENT        │        │    * 440x56 en reposo (Isla)  │
│  - Click-Through Total      │        │    * 660x820 al expandirse    │
│  - Solo Canvas en bordes    │        │  - Prioridad Z-Order Absoluta │
│                             │        │  - WebView2CompositionControl │
│  - Centro 100% transparente │        │  - Panel Arrastrable (Drag)   │
└─────────────────────────────┘        └───────────────────────────────┘
```

---

## 4. Modos Visuales y Opciones Implementadas

### A. Los 5 Modos Visuales en los Bordes
Todos los modos comparten helpers de geometría por borde (`edgeGeometry`, `edgeRect`, `edgeGradient`) y un estado suavizado por borde (`smoothRef`) que sube rápido y baja lento para evitar temblores.

1. **🌊 Neon Waves (Hiper-Reactivo):**
   - 3 capas de ondas con ciclos y velocidades distintas, trazadas como curvas suaves (`quadraticCurveTo` por puntos medios).
   - Aspecto neón: dos pasadas anchas de baja opacidad como halo (más barato que `shadowBlur`) + núcleo sólido.
   - Degradado de la paleta a lo largo del borde y relleno translúcido entre el borde y la onda principal.
   - Envolvente que lleva la onda a cero en las esquinas: los 4 bordes se unen limpio.
   - Energía espejada (bajos al centro de cada borde) y suavizada en el tiempo; los agudos añaden un rizado fino.
2. **☀️ Fluid Glow (Ambilight):**
   - Manchas de luz elípticas (degradados radiales estirados) que flotan lentamente a lo largo de cada borde; cada una ligada a una banda de frecuencia y crece con el bajo.
   - Franja base pegada al borde que respira con el volumen.
   - Color tomado del degradado continuo de la paleta.
3. **📊 Cyberpunk EQ (LED Segmentado):**
   - Barras divididas en segmentos tipo LED, más tenues en la base y a pleno brillo en la punta.
   - Degradado continuo de color a lo largo del borde (ya no 3 bloques; ver Error 10).
   - Línea base luminosa, halo por barra (una sola sombra por barra) y picos flotantes del color de su barra.
   - Cantidad de barras proporcional al largo del borde (~1 cada 34px) para que en ultrawide no queden gigantes.
   - Espectro espejado: bajos al centro, agudos hacia las esquinas.
4. **▫️ Minimal EQ (Nuevo):**
   - Barritas finas de 3px redondeadas, sin glow, con bajos al centro de cada borde.
   - Suben rápido y bajan suave; largo máximo ~1.1× el grosor del borde.
5. **⚡ Electric Plasma & Sparks (Reemplazo de Vaporwave):**
   - Rayo de plasma eléctrico que recorre los bordes con jitter fractal modulado por agudos.
   - En cada golpe de bajo dispara arcos de relámpago y chispas de energía hacia adentro.

### B. Paletas de Color
- **Dynamic Rainbow 🌈:** Rotación continua de 360° en tiempo real. Los golpes de bajo aceleran la rotación cromática. Luminosidad fija en 50% (color puro; ver Error 11).
- **Cyberpunk Hyper-Neon:** Cyan `#00f0ff`, magenta `#ff0077` y púrpura `#9900ff`.
- **Synthwave Fire:** Naranja fuego `#ff3300`, rosa neón `#ff0066` y amarillo oro `#ffcc00`.
- **Matrix Laser Green:** Verde fósforo `#00ff66` y cyan láser `#00ffcc`.
- **Electric Blue & Gold:** Azul eléctrico `#00e5ff` y oro brillante `#ffbb00`.
- **Paletas sólidas (nuevas):** RGB Puro (`#ff0000`, `#00ff00`, `#0000ff`), Rojo Sólido, Azul Sólido, Verde Sólido, Morado Sólido y Blanco Puro.
- **Music Reactive Art:** Extraído de la miniatura de la canción activa.
- **Personalizado:** Selector de colores primarios y secundarios.

### C. Centro de Control & Isla Dinámica
- **Isla Dinámica (Arriba al centro):**
  - Pastilla ultra-minimalista negra azabache (`bg-black/90 backdrop-blur-2xl border border-white/15`).
  - Micro-vúmetro de 3 barras blancas delgadas (2px) que oscilan con la música.
  - Título inteligente: detecta canciones de YouTube/Spotify o muestra *"Audio en Reproducción"* si hay sonido activo.
  - Botón discreto de **`Ajustes`**.
  - Animaciones fluidas: el ancho cambia con curva tipo *spring* de iOS (`cubic-bezier(0.32, 0.72, 0, 1)`, 500ms); el nombre del artista se despliega con `grid-template-rows` y el botón de encendido se desliza, en vez de montarse de golpe.
  - Las 3 micro-barras se animan con `transform: scaleY` (no provoca relayout) y una transición corta de 90ms.
- **Panel de Opciones Arrastrable:**
  - Puede arrastrarse a cualquier punto de la pantalla sujetándolo de la barra superior.
  - Toggles individuales para activar/desactivar cada borde (Arriba, Abajo, Izquierda, Derecha).
  - Sliders para grosor de borde (10px a 70px), sensibilidad y nivel de glow.
  - Botón de cierre (`X`) que encoge la ventana de vuelta a la Isla Dinámica compacta.

---

## 5. Historial de Errores Encontrados y Soluciones Aplicadas

### Error 1: Fallo del Linker MSVC en Rust (`link.exe not found` / Falta Windows SDK)
- **Causa:** El plan original proponía Tauri v2 con Rust, pero la máquina del usuario no tenía instalado el Windows 10/11 SDK para el compilador MSVC C++, y `winget install` requería elevación de permisos UAC de administrador.
- **Solución:** Se pivoteó a **.NET 10 (C#) + WebView2**. .NET 10 ya estaba instalado y compila en < 2 segundos con soporte nativo de WinRT y WASAPI sin requerir Windows SDK externo ni linkers de C++.

### Error 2: Error "No se encuentra el archivo" al Iniciar la App
- **Causa:** WebView2 intentaba navegar a `file:///C:/path/dist/index.html?mode=overlay`. En Windows, Chromium interpretaba el signo `?` como parte del nombre del archivo en el sistema de archivos NTFS, lanzando `ERR_FILE_NOT_FOUND`. Además, `run.bat` no fijaba el directorio de trabajo.
- **Solución:** Se implementó `SetVirtualHostNameToFolderMapping` en C#, mapeando la carpeta `dist` a los orígenes virtuales internos `https://visualizer.overlay/` y `https://visualizer.control/`. En `run.bat` se añadió `cd /d "%~dp0"`.

### Error 3: Fondo Azul Opaco que Tapaba las Aplicaciones del Usuario
- **Causa:** `index.html` tenía asignada la clase `<body class="bg-slate-950">` (color azul marino oscuro de Tailwind) y `App.tsx` renderizaba un layout con fondo oscuro antes de detectar la URL.
- **Solución:** Se removieron las clases de fondo de `index.html`, se inyectó `background: transparent !important` en `html`, `body` y `#root`, y se configuró `DefaultBackgroundColor = Color.FromArgb(0,0,0,0)` y `Background="{x:Null}"` en WPF/WebView2.

### Error 4: Cyberpunk EQ Congelado en el Techo (Saturación de Audio)
- **Causa:** En `AudioEngine.cs`, la magnitud del bin FFT no se dividía entre el tamaño de la ventana ($N/4 = 256$) y además se multiplicaba por 15x, disparando valores superiores a 150.0 que se estampaban contra el límite 1.0 de `Math.Clamp`. Las barras permanecían fijas al 100% y solo se movían en el silencio absoluto.
- **Solución:** Se normalizó dividiendo por 256.0f y se aplicó una curva de compresión perceptual gamma: `Math.Pow(bandEnergy * 5.0f * boost, 0.75)`. Las barras ahora oscilan dinámicamente entre 5% y 85% de la altura.

### Error 5: Modo Vaporwave Ribbons Deficiente
- **Causa:** El modo no era reactivo y lucía tosco y monótono.
- **Solución:** Se reemplazó por el modo **Electric Plasma & Sparks ⚡**, con arcos eléctricos fractales y chispas luminosas que saltan con cada golpe de bombo.

### Error 6: Detección Nula de YouTube en Navegadores ("Esperando música...")
- **Causa:** `_sessionManager.GetCurrentSession()` en Windows devuelve `null` si la ventana del navegador no tiene el foco activo en ese milisegundo.
- **Solución:** Se migró a `_sessionManager.GetSessions()`, escaneando la lista de sesiones activas en busca de la que tenga `PlaybackStatus == Playing`. Se agregó sondeo cada 1 segundo y un fallback que muestra *"Audio en Reproducción"* si se detecta sonido en la salida de audio.

### Error 7: Clics en la Isla Dinámica Traspasaban y Cerraban Ventanas de Fondo ("Ventana Fantasma")
- **Causa:**
  1. `MainWindow` medía 720x820px de forma fija. Aunque la isla solo medía 40px arriba, los 780px de abajo eran una ventana invisible sobre la pantalla del usuario.
  2. `OverlayWindow` (pantalla completa con `WS_EX_TRANSPARENT`) se montaba por encima de `MainWindow` en el Z-Order.
  3. Al hacer clic sobre la isla, Windows traspasaba el evento a través del overlay y de la ventana con fondo nulo, cerrando la ventana que el usuario tenía detrás.
- **Solución:**
  1. **Tamaño Adaptativo Real:** En reposo, `MainWindow` mide **físicamente solo 440px × 56px**. Solo cubre la pastilla de la isla; el resto del monitor queda 100% libre. Al abrir opciones, se expande a 660px × 820px mediante el evento IPC `set-window-expanded`.
  2. **Z-Order Garantizado:** `MainWindow` se inicializa con prioridad máxima sobre `OverlayWindow` mediante `Topmost = true` y `Activate()`.
- **Nota:** estas medidas redujeron la ventana invisible, pero no eran la causa raíz de que los clics traspasaran la isla. La causa real está en el Error 9.

### Error 8: Isla Dinámica Poco Minimalista
- **Causa:** Tenía un icono con un círculo verde pulsando con `animate-ping` que restaba elegancia.
- **Solución:** Se eliminó el círculo verde pulsante y se rediseñó como una pastilla negra azabache con micro-barras blancas finas (2px) y botón directo de `Ajustes`.

### Error 9: La Isla Dinámica no Recibía Clics (Traspasaban a la Ventana de Fondo)
- **Causa:** `MainWindow` tiene `AllowsTransparency="True"`, así que es una ventana *layered* donde Windows decide quién recibe el clic según el alfa de cada píxel. El control `WebView2` clásico es un `HwndHost` (una ventana Win32 hija) que dibuja fuera del árbol visual de WPF. Para Windows, toda la superficie de la ventana era transparente aunque la isla se viera en pantalla, y cada clic pasaba a la ventana de abajo.
- **Solución:** En `MainWindow.xaml` se reemplazó `wv2:WebView2` por `wv2:WebView2CompositionControl` (incluido en el paquete `Microsoft.Web.WebView2` 1.0.4314.35). Este control dibuja dentro del árbol visual de WPF: los píxeles opacos de la isla reciben el clic y las zonas transparentes lo siguen dejando pasar. La API es idéntica, así que `MainWindow.xaml.cs` no cambió. `OverlayWindow` mantiene el `WebView2` clásico porque debe ser 100% click-through.
- **Costo:** El control redibuja la página por captura, lo que consume algo más de GPU y puede limitar la fluidez de animaciones; en una ventana de 440×56 no es perceptible.

### Error 10: Cambio de Color Brusco en Cyberpunk EQ (3 Bloques)
- **Causa:** El color de cada barra se elegía por tramos fijos (`t < 0.4` → color 1, `t < 0.75` → color 2, resto → color 3). En un monitor de 34" cada tramo es muy ancho y el salto se notaba.
- **Solución:** Degradado continuo con `sampleGradient()` (interpolación entre los 3 colores de la paleta). La mezcla RGB lineal oscurecía los tonos intermedios (rojo + verde = oliva), así que se restaura el brillo de los extremos tras mezclar.

### Error 11: Colores Pastel / Lavados
- **Causa:** En la paleta Dynamic Rainbow la luminosidad HSL subía hasta 90% con cada golpe de bajo (`52 + bass * 35`), lo que mezcla el color con blanco.
- **Solución:** Luminosidad fija en 50% (tono puro) y nuevas paletas sólidas.

### Error 12: Clic en el Título de la Isla Abría y Cerraba el Panel a la Vez
- **Causa:** Tanto el `div` interior del título como el contenedor de la isla tenían `onClick={onToggleOpen}`. El evento burbujeaba y el panel se alternaba dos veces.
- **Solución:** Se dejó un único `onClick` en el contenedor.

### Error 13: Bucle de Render del Canvas se Reiniciaba 60 Veces por Segundo
- **Causa:** El `useEffect` del canvas dependía de `audioData`, así que en cada frame de audio cancelaba y recreaba el `requestAnimationFrame`, reasignando además `canvas.width/height` (lo que limpia y realoca el lienzo).
- **Solución:** El bucle se crea una sola vez (`useEffect(..., [])`) y lee `settings`, `audioData` y `dominantColor` desde refs actualizados en cada render de React.

### Mejoras de Distribución
- El ejecutable se llama `EdgeAudioVisualizer.exe` (`<AssemblyName>` en el `.csproj`; el namespace sigue siendo `ScreenAudioVisualizer`).
- **Instancia única:** un `Mutex` en `App.OnStartup` evita abrir dos copias (dos overlays encimados) y avisa al usuario.
- **WebView2 ausente:** si `GetAvailableBrowserVersionString()` lanza `WebView2RuntimeNotFoundException`, se muestra un mensaje en español y se ofrece abrir la página de descarga.
- **Paquete portable:** `build-release.ps1` publica self-contained single-file comprimido (~83 MB el .exe, ~73 MB el .zip) junto a `dist\` y `LEEME.txt`.

---

## 6. Estructura de Archivos Clave

```
music-visualizer-pc/
├── dist/                               # Bundle compilado de React para producción
├── run.bat                             # Lanzador directo con 1 clic para Windows
├── run.ps1                             # Script PowerShell de ejecución
├── build-release.ps1                   # Empaquetado portable (self-contained single-file + dist) en .zip
├── LEEME.txt                           # Instrucciones para usuarios finales incluidas en el .zip
├── docs/icon.png                       # Icono usado en el README
├── package.json                        # Scripts npm y dependencias frontend
├── vite.config.ts                      # Configuración de Vite con Tailwind v4
├── index.html                          # Punto de entrada HTML con transparencia forzada
├── .claude/launch.json                 # Config del servidor Vite (puerto 1420) para la vista previa de Claude Code
│
├── src/                                # Código Fuente Frontend (React + TypeScript)
│   ├── components/
│   │   ├── EdgeVisualizerCanvas.tsx    # Motor de renderizado Canvas 2D (los 5 modos + helpers de color/geometría)
│   │   ├── DynamicIsland.tsx           # Isla Dinámica superior minimalista
│   │   └── ControlCenter.tsx           # Panel de opciones flotante y arrastrable
│   ├── nativeBridge.ts                 # Puente IPC C# <-> JS y Web Audio API
│   ├── types.ts                        # Interfaces, paletas y constantes globales
│   ├── App.tsx                         # Router por query params (?mode=overlay / control)
│   ├── main.tsx                        # Montaje de React
│   └── index.css                       # Directivas de Tailwind v4 y estilos base
│
└── src-csharp/                         # Código Fuente Backend (.NET 10 / WPF)
    ├── AudioEngine.cs                  # WASAPI Loopback + FFT Radix-2 + 64 bandas
    ├── MediaTracker.cs                 # SMTC Windows Media Controls (YouTube/Spotify)
    ├── Win32Helper.cs                  # Interop Win32 (WS_EX_TRANSPARENT, click-through)
    ├── OverlayWindow.xaml(.cs)         # Ventana overlay pantalla completa transparente
    ├── MainWindow.xaml(.cs)            # Ventana interactiva (Isla Dinámica + Panel) con WebView2CompositionControl
    ├── App.xaml(.cs)                   # Ciclo de vida WPF: instancia única (Mutex) y aviso si falta WebView2
    ├── app.ico                         # Icono del programa (.exe, barra de tareas y bandeja)
    └── ScreenAudioVisualizer.csproj    # Configuración de compilación .NET 10
```

---

## 7. Comandos de Operación

- **Ejecutar la aplicación completa de escritorio:**
  ```cmd
  run.bat
  ```
  o
  ```bash
  npm run start:app
  ```
- **Probar en navegador con simulador y micrófono:**
  ```bash
  npm run dev
  ```
  (Abre `http://localhost:1420`)
- **Compilar frontend para producción:**
  ```bash
  npm run build
  ```
- **Generar el paquete portable para compartir (.zip self-contained, no requiere .NET instalado):**
  ```powershell
  .uild-release.ps1
  ```
  Sale en `release\EdgeAudioVisualizer-v<version>-win-x64.zip` y se sube como Release en GitHub. La versión viene de `<Version>` en el `.csproj`.
- **Compilar backend en C#:**
  ```bash
  dotnet build src-csharp
  ```
