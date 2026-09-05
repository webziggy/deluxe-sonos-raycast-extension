# Deluxe Sonos Controller for Home Assistant (Raycast)

A native, blazing-fast Raycast extension to seamlessly control your Sonos ecosystem via Home Assistant.


## Features

- **🎵 Menu Bar Controller**: A native macOS menu bar dropdown for instantly controlling your pinned default speaker.
- **⭐️ Menu Bar Favourites**: Instantly access your favourites from the Menu Bar, intelligently grouped into native macOS sub-menus (Playlists, Radio, etc.) matching your Favourites Grid.
- **⏯️ Play Last**: A quick action dynamically appears when nothing is playing, allowing you to instantly resume your last played favourite.
- **🛡️ Robust Stability**: Built-in Error Boundaries and zero-latency caching ensure the extension perfectly syncs with Home Assistant without freezing.

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


## Local vs External URL (and the macOS ATS Restriction)

The extension allows you to configure two URLs in the preferences:
- **Local URL (Optional):** e.g., `http://homeassistant.local:8123`
- **External URL (Required):** e.g., `https://xxxx.ui.nabu.casa`

For maximum speed, if a Local URL is provided, the extension will instantly ping it on boot. If it's reachable, it will route all WebSocket and API traffic securely over your local network for 0ms latency. If it fails (e.g., you leave the house), it seamlessly falls back to the External URL.

**Why is an External URL required?** 
While `http://` works flawlessly for raw API traffic, Apple enforces strict **App Transport Security (ATS)** rules on native macOS UI elements. This means Raycast will silently refuse to render Album Artwork served over an insecure `http://` connection! 

To solve this, the extension is intentionally designed to hijack image requests and route them through your External `https://` URL (if your local URL isn't already `https://`), satisfying Apple's security requirements while keeping your core control traffic blisteringly fast on the local network. 

*(Note: If you do not have an External URL and only provide a local HTTP address, the extension and Companion App will still work perfectly—you just won't see Album Artwork in Raycast!)*

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

## The Companion App (Desktop Notifications & History)

The repository also includes a standalone Flutter desktop app (`companion_app/`) that runs silently in the macOS background to provide:
- **🔔 Real-time Track Notifications**: Native, beautiful desktop popups when a new song starts playing.
- **🖼️ iTunes API Fallback**: Automatically upgrades low-res radio station art to high-res Apple Music album art, while rendering the station logo as a gorgeous badge.
- **🛡️ Regex Blocklists**: Filter out annoying notification spam (like "Sponsored by..." or "News at 10") by configuring Regex allowlists/blocklists via the `Sonos Notification Filters` Raycast command.
- **📻 Radio Station Manager**: Fully customize the metadata and artwork of your live radio streams using the `Sonos Manage Radio Stations` command. Bind streams to a known Sonos Favourite, upload a custom badge image, or explicitly override the Artist/Track fields to fix stations that broadcast them backward!
- **💾 Backup & Restore**: Instantly export your entire custom configuration (Regex filters and Radio Station metadata) to a single JSON payload using the `Sonos Backup & Restore` command, allowing you to easily transfer your setup between Macs.
- **🌐 Locale Aware**: Automatically detects your macOS region to display localized spelling (e.g., *Favourites* vs *Favorites*) across the entire UI.
- **🌓 Dynamic Icons**: Custom SVGs automatically invert perfectly between Light and Dark mode across the Raycast UI and the macOS menu bar.
- **🕒 System Tray History**: Click the small Sonos icon in your macOS system tray to view your recently played tracks, or click a track to re-raise the notification.
- **🛠️ Debugging**: Use the `Sonos Debug States` and `Sonos Debug Notifications` Raycast commands to inspect Home Assistant metadata or manually re-raise historic payloads.

*Note: The companion app boots automatically when you use the Raycast extension and stays alive in the background.*

## Architecture & Documentation

For developers looking to understand the inner workings of the Companion App, including how we gracefully handle wild inconsistencies in Home Assistant's UPnP/ICY metadata parsing across different radio stations, check out the documentation below:

- [Home Assistant Metadata Quirks & The iTunes API Fetcher](./docs/metadata-quirks.md)

---
Built with ❤️ using the official Raycast API and the \`home-assistant-js-websocket\` library.
