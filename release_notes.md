# What's New in v1.1.0

This is a massive feature update that brings deep Home Assistant integration, blazing-fast local caching, and heavily optimized macOS UI/UX tweaks. 

### 🎉 Features & Enhancements
- **Party Mode Grouping**: Added a one-click "Group All" button to instantly bind every standalone speaker on your network to the current room, and an "Ungroup All" button to shatter them back to standalone.
- **Dynamic Audio Settings**: Automatically sniffs and constructs native EQ sub-menus (Bass, Treble, Subwoofer Gain, Surround Level, Loudness) strictly matched to the physical capabilities of each individual speaker.
- **0ms Favourites Caching**: The Favourites grid now features a silent background cache. It loads instantly (0ms) without ever showing a loading spinner while fetching updates behind the scenes.
- **Rich Favourites Grid**: Restructured Favourites into native Raycast Grid Sections matching their original Sonos folder categories with high-res thumbnails.
- **Live Queue Management**: Added destructive actions to the Queue view. You can now press `Cmd + Backspace` to remove a single track, or `Cmd + Shift + Backspace` to clear the entire queue.
- **Sleep Timers**: Instantly set or clear a sleep timer (15–120 minutes) directly from the menu bar with native macOS HUD Toast notifications for feedback.
- **Connection Resilience**: Embedded a silent background 30-second heartbeat to instantly recover the Home Assistant WebSocket connection when macOS wakes from sleep.
- **Global Shortcuts**: Added lightning-fast global menu shortcuts (`Cmd+F` for Favourites, `Cmd+O` for Queue, and `Cmd+G` for Party Mode).

### 💅 UI/UX Polish
- **Dynamic Play/Pause Button**: The Play/Pause control now adheres to industry UX standards by dynamically reflecting the *Action* (e.g., showing "Pause" when playing) instead of the state.
- **Type-To-Jump NLP Fix**: Implemented a clever Braille Pattern Blank (`\u2800`) hack to prevent the currently playing track from hijacking the native macOS letter-based keyboard navigation.
- **Menu Layout Re-org**: Logically grouped Favourites and Queue items contextually beneath their respective media controls.
- **Hitbox Widening**: Artificially widened the EQ and Exact Volume submenu labels to prevent the mouse from accidentally slipping off and collapsing the menu.

### 🐛 Bug Fixes
- Fixed a strict Sonos device detection heuristic to correctly filter out non-Sonos media players like Apple TVs.
- Fixed queue payload parsing for newer HA versions.
- Fixed shuffle/repeat casing issues.
