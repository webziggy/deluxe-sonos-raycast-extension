# macOS Menu Bar Template Icon Guide

When designing custom macOS system tray / menu bar icons (e.g., for the Sonos Companion App), macOS uses a special "Template" system to automatically adapt the icon to Light and Dark modes.

To ensure your icon renders flawlessly, follow these exact specifications when designing in Adobe Illustrator (or any vector graphics tool):

## 1. Color & Fill
- The design must be **100% solid Black (`#000000`)** on a **completely transparent background**.
- **Do not use white, gray, or colors.** 
- macOS Template icons ignore color data completely and *only* look at the alpha channel (transparency). Wherever there is a solid pixel, macOS will dynamically paint it the correct contrast color (White in Dark Mode, Black in Light Mode).

## 2. Artboard Dimensions (Retina)
- Set your artboard strictly to **44 x 44 pixels**.
- This corresponds to the standard macOS `@2x` retina height for menu bar assets (which physically render in a 22pt high menu bar).

## 3. Padding & Safe Area
- **Do not fill the entire 44x44 artboard.** 
- Keep your actual icon artwork visually centered within a **36 x 36 pixel** "Safe Area".
- This leaves at least 4 pixels of completely transparent empty space on all sides, ensuring the icon perfectly matches the physical scale and vertical alignment of native Apple menu bar icons without touching the edges.

## 4. Export Format & Naming
- Export the final asset as a **PNG**.
- You must name the file exactly ending in the word `Template.png` (e.g., `app_iconTemplate.png`).
- The word `Template` at the end of the filename is the magic keyword that forces the macOS rendering engine (and the `system_tray` plugin) to treat it as a dynamic alpha mask instead of a static image.
