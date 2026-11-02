<p align="center">
  <img src="docs/icon.png" width="120" alt="Edge Audio Visualizer" />
</p>

<h1 align="center">Edge Audio Visualizer</h1>

<p align="center">
  Luces y efectos en los bordes de tu pantalla que bailan con la música que suena en tu PC.<br/>
  Siempre visibles encima de todo, pero sin bloquear nunca el ratón.
</p>

<p align="center">
  <a href="https://github.com/amleman/edge-audio-visualizer/releases/latest"><b>⬇️ Descargar para Windows</b></a>
</p>

---

## 🙋 Para usarlo (no necesitas saber nada técnico)

1. Entra en **[Descargas](https://github.com/amleman/edge-audio-visualizer/releases/latest)** y haz clic en el archivo **`EdgeAudioVisualizer-...-win-x64.zip`** (en la sección *Assets*).
2. Cuando termine de descargar, haz clic derecho en el `.zip` → **Extraer todo...** → **Extraer**.
3. Abre la carpeta **Edge Audio Visualizer** y haz doble clic en **`EdgeAudioVisualizer.exe`**.
4. Si aparece **"Windows protegió su PC"**, haz clic en **Más información** → **Ejecutar de todas formas**.
   *(Sale porque el programa es nuevo y no está firmado, no porque tenga virus.)*
5. Pon música en Spotify, YouTube o lo que quieras: los bordes de la pantalla empezarán a moverse. 🎶

**Cómo se usa:**
- Arriba en el centro aparece una pastilla negra con la canción que está sonando. Haz clic en **Ajustes** para cambiar el estilo, los colores, el grosor y la sensibilidad.
- Puedes seguir usando tu PC normalmente: los clics atraviesan los efectos.
- Para cerrarlo: clic derecho en su icono junto al reloj de Windows → **Salir**.
- Para tener un acceso directo: clic derecho en `EdgeAudioVisualizer.exe` → **Mostrar más opciones** → **Enviar a** → **Escritorio (crear acceso directo)**.

**Requisitos:** Windows 10 u 11 de 64 bits. No hace falta instalar nada más.
Si te dice que falta **WebView2**, acepta abrir la página, instálalo y vuelve a abrir el programa.

> ⚠️ No borres la carpeta `dist` que está junto al programa: ahí vive su interfaz.

---

## ✨ Qué incluye

**5 estilos de visualización**
- 🌊 **Neon Waves:** tres capas de ondas neón suaves que se aceleran con cada golpe de bajo.
- ☀️ **Fluid Glow:** manchas de luz ambiental que flotan por los bordes y respiran con la música.
- 📊 **Cyberpunk EQ:** barras de ecualizador tipo LED con picos flotantes.
- ▫️ **Minimal EQ:** barritas finas y discretas, sin brillo.
- ⚡ **Electric Plasma:** un rayo eléctrico que recorre la pantalla y lanza chispas con los bajos.

**Paletas de color:** Dynamic Rainbow 🌈, Cyberpunk, Synthwave, Matrix, Electric Blue, RGB Puro, colores sólidos (rojo, azul, verde, morado, blanco), color de la carátula de la canción o tus propios colores.

**Isla dinámica:** muestra lo que suena en Spotify, YouTube (Chrome/Edge) y otros reproductores, con un mini ecualizador.

**Ajustes:** grosor del borde, sensibilidad, intensidad del brillo, velocidad y qué bordes de la pantalla usar.

---

## 🛠️ Para desarrolladores

### Tecnologías
- **Host nativo:** C# / .NET 10 + WPF + WebView2
- **Audio:** NAudio con WASAPI Loopback (captura el audio del sistema sin cables virtuales) y FFT propia de 1024 puntos → 64 bandas
- **Música actual:** Windows System Media Transport Controls (SMTC)
- **Interfaz y gráficos:** React 19 + TypeScript + Vite + Tailwind CSS v4, renderizado en Canvas 2D

Hay dos ventanas: un overlay de pantalla completa 100% *click-through* que dibuja los bordes, y una ventana pequeña e interactiva con la isla dinámica y el panel de ajustes. Los detalles de arquitectura y el historial de problemas resueltos están en [`contexto.md`](contexto.md).

### Requisitos
- [Node.js](https://nodejs.org/) 20 o superior
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- Windows 10 (19041) o superior

### Comandos
```bash
npm install            # instalar dependencias del frontend
npm run start:app      # compilar y abrir la app de escritorio
npm run dev            # probar la interfaz en el navegador (http://localhost:1420) con audio simulado
```

También puedes abrir la app con doble clic en `run.bat`.

### Crear el paquete para compartir
```powershell
.\build-release.ps1
```
Genera `release\EdgeAudioVisualizer-v<versión>-win-x64.zip`, una versión portable que incluye .NET (quien lo descargue no tiene que instalar nada). La versión se toma de `<Version>` en `src-csharp/ScreenAudioVisualizer.csproj`.

### Estructura
```
src/                      Interfaz React (canvas de efectos, isla dinámica, panel de ajustes)
src-csharp/               Host WPF: ventanas, captura de audio, FFT, SMTC
build-release.ps1         Empaquetado portable para compartir
LEEME.txt                 Instrucciones que van dentro del .zip
contexto.md               Documentación técnica e historial de decisiones
```
