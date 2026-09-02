# Deluxe Sonos Controller for Home Assistant (Raycast)

A native, blazing-fast Raycast extension to seamlessly control your Sonos ecosystem via Home Assistant.


## Features

- **🎵 Menu Bar Controller**: A native macOS menu bar dropdown for instantly controlling your pinned default speaker.
- **🖼️ Rich Favourites Grid**: A beautiful Raycast Grid view that pulls in your Sonos radio stations and Spotify playlists with high-res album artwork. Features 0ms caching for instant loading without a spinner.
- **📋 Live Playback Queue**: A detailed List view showing the current playback queue for any speaker, with the ability to jump to tracks, remove them (`Cmd + Backspace`), or clear the entire queue (`Cmd + Shift + Backspace`).
- **🤝 Intelligent Grouping**: Automatically detects grouped speakers, providing master controls alongside fully independent volume overrides for each member.
- **🎉 Party Mode Grouping**: Includes a one-click "Group All (Party Mode)" button to instantly bind every standalone speaker on your network to the current room, and an "Ungroup All" button to shatter the group back to standalone speakers.
- **🎚️ Dynamic Audio Settings**: Automatically sniffs and constructs native EQ sub-menus (Bass, Treble, Subwoofer Gain, Surround Level, Loudness) strictly matched to the physical capabilities of each individual speaker on your network.
- **💤 Sleep Timers**: Instantly set or clear a sleep timer (15–120 minutes) directly from the menu bar. *(Note: While setting a timer works perfectly, Home Assistant does not expose the remaining countdown time as an entity, so the UI is currently limited to "fire-and-forget" commands).*
- **📌 Pinned Speakers**: Pin your favorite speaker to the root of the menu bar for instant access.
- **🕒 Contextual Track History**: Every speaker maintains its own dedicated "Recently Played" history right inside its sub-menu.
- **🔍 Instant Web Search**: Click any currently playing track or history item to instantly look it up in your default browser.
- **🚀 Zero Polling & Resilient**: Uses a highly optimized WebSocket connection to Home Assistant for instant push-updates, complete with a lightweight background heartbeat to instantly recover the connection when macOS wakes from sleep.

## Installation (Local Sideloading)

Since this extension is currently in private beta and not yet published to the public Raycast Store, you will need to install it locally from source. You only need to do this once!

1. **Clone the Repository**:
   Download the source code to your Mac.
   ```bash
   git clone https://github.com/webziggy/deluxe-sonos-raycast-extension.git
   cd deluxe-sonos-raycast-extension/extension
   ```

2. **Install Dependencies**:
   Ensure you have [Node.js](https://nodejs.org/) installed, then run:
   ```bash
   npm install
   ```

3. **Build & Register with Raycast**:
   Run the development command once to compile the code and register the extension with your local Raycast app:
   ```bash
   npm run dev
   ```
   *Note: Once the command finishes and the extension appears in Raycast, you can safely kill the terminal process (`Ctrl + C`). The extension is now permanently compiled into Raycast!*

4. **Configure Preferences**:
   When you run the extension for the first time in Raycast, it will prompt you for two things:
   - **Home Assistant URL**: The local or external URL to your HA instance (e.g., `http://homeassistant.local:8123` or your Nabu Casa URL).
   - **Long-Lived Access Token**: Generate this in Home Assistant by clicking your Profile in the bottom left -> Security -> Long-Lived Access Tokens.

## Strict Filtering (Optional)
By default, the extension uses an intelligent heuristic (looking for \`group_members\`) to automatically filter out non-Sonos media players like Apple TVs. If an unwanted device slips through, open the Extension Preferences (\`Cmd + ,\`) and enter a comma-separated list of your exact Sonos Entity IDs into the **Include Only These Entities** field.

## Keyboard Shortcuts (Menu Bar)
When the Sonos Menu Bar is open, you can use the following quick hotkeys:
- **Play/Pause**: `Cmd + P`
- **Next Track**: `Cmd + Right Arrow`
- **Previous Track**: `Cmd + Left Arrow`
- **Volume Up**: `Cmd + +`
- **Volume Down**: `Cmd + -`
- **Toggle Mute**: `Cmd + M`
- **Open Favourites**: `Cmd + F`
- **Open Queue**: `Cmd + O`
- **Group All (Party Mode)**: `Cmd + G`

---
Built with ❤️ using the official Raycast API and the \`home-assistant-js-websocket\` library.
