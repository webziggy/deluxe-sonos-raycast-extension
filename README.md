# Deluxe Sonos Controller for Home Assistant (Raycast)

A native, blazing-fast Raycast extension to seamlessly control your Sonos ecosystem via Home Assistant.

<img width="800" src="https://raycast.com/uploads/commands/media-player.png" alt="Deluxe Sonos Controller" />

## Features

- **🎵 Menu Bar Controller**: A native macOS menu bar dropdown for instantly controlling your pinned default speaker.
- **🖼️ Rich Favourites Grid**: A beautiful Raycast Grid view that pulls in your Sonos radio stations and Spotify playlists with high-res album artwork.
- **📋 Live Playback Queue**: A detailed List view showing the current playback queue for any speaker, with the ability to jump to tracks or remove them instantly.
- **🤝 Intelligent Grouping**: Automatically detects Sonos grouped speakers, consolidates their UI, and scales group volume simultaneously.
- **📌 Pinned Speakers & Tracks**: Pin your favorite speaker to the root of the menu bar, and optionally pin the currently playing track name right into your Mac's menu bar text!
- **🚀 Zero Polling**: Uses a highly optimized WebSocket connection to Home Assistant for instant push-updates with near-zero CPU footprint.

## Setup Instructions

1. **Install Dependencies**:
   Open a terminal in the `extension` directory and run:
   \`\`\`bash
   npm install
   \`\`\`

2. **Start Development**:
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Configure Preferences**:
   When you run the extension for the first time in Raycast, it will prompt you for two things:
   - **Home Assistant URL**: The local or external URL to your HA instance (e.g., `http://homeassistant.local:8123` or your Nabu Casa URL).
   - **Long-Lived Access Token**: Generate this in Home Assistant by clicking your Profile in the bottom left -> Security -> Long-Lived Access Tokens.

## Strict Filtering (Optional)
By default, the extension uses an intelligent heuristic (looking for \`group_members\`) to automatically filter out non-Sonos media players like Apple TVs. If an unwanted device slips through, open the Extension Preferences (\`Cmd + ,\`) and enter a comma-separated list of your exact Sonos Entity IDs into the **Include Only These Entities** field.

## Keyboard Shortcuts (Menu Bar)
When the Sonos Menu Bar is open, you can use the following quick hotkeys:
- **Play/Pause**: \`Cmd + P\`
- **Next Track**: \`Cmd + Right Arrow\`
- **Previous Track**: \`Cmd + Left Arrow\`
- **Volume Up**: \`Cmd + +\`
- **Volume Down**: \`Cmd + -\`

---
Built with ❤️ using the official Raycast API and the \`home-assistant-js-websocket\` library.
