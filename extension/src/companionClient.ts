/**
 * @fileoverview Companion App Client
 * Handles HTTP communication between the Raycast Extension and the local Dart Companion App.
 * The Companion App runs a local HTTP server on port 8079.
 */

import fetch from "node-fetch";

const COMPANION_URL = "http://127.0.0.1:8079";

/**
 * Pings the Companion App to check if it is running and accessible.
 * @returns {Promise<boolean>} True if the Companion App responds successfully, false otherwise.
 */
export async function pingCompanionApp(): Promise<boolean> {
  try {
    const res = await fetch(`${COMPANION_URL}/ping`, { method: "GET" });
    return res.ok;
  } catch (e) { console.error('Silent error caught:', e); }
  return false;
}

/**
 * Syncs the user's currently pinned speaker to the Companion App.
 * This tells the Companion App which speaker's track metadata should be actively monitored
 * and displayed in the macOS Notification Center.
 * 
 * @param {string | undefined} entityId - The Home Assistant entity ID of the speaker to pin, or undefined to unpin.
 */
export async function syncPinnedSpeakerToCompanion(
  entityId: string | undefined,
) {
  try {
    await fetch(`${COMPANION_URL}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId: entityId || null }),
    });
  } catch (e) { console.error('Silent error caught:', e); }
}

/**
 * Sends the regex allowlist and blocklist to the Companion App.
 * These filters are used by the Companion App to prevent spammy or unwanted notifications 
 * (like ads or station jingles) from polluting the macOS Notification Center.
 * 
 * @param {string[]} allowlist - Array of regex strings that are explicitly allowed.
 * @param {string[]} blocklist - Array of regex strings that should be blocked.
 */
export async function syncFiltersToCompanion(
  allowlist: string[],
  blocklist: string[],
) {
  try {
    await fetch(`${COMPANION_URL}/filters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowlist, blocklist }),
    });
  } catch (e) { console.error('Silent error caught:', e); }
}

/**
 * Sends custom Radio Station configurations to the Companion App.
 * This includes custom badge URLs and iTunes parsing modes (e.g., swapping Song/Artist fields)
 * so the Companion App can correctly format the Notification UI and fetch high-res iTunes artwork.
 * 
 * @param {Record<string, any>} config - A dictionary mapping station names to their configuration objects.
 */
export async function saveStationConfig(config: Record<string, any>) {
  try {
    await fetch(`${COMPANION_URL}/station_config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  } catch (e) { console.error('Silent error caught:', e); }
}
