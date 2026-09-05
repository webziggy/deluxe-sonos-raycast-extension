import { LocalStorage } from "@raycast/api";
import fs from "fs";
import os from "os";
import path from "path";

interface CompanionAuth {
  port: number;
  token: string;
}

function getAuthDetails(): CompanionAuth | null {
  try {
    const authPath = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "com.webziggy.sonos_companion",
      ".sonos_companion_auth.json",
    );
    // On macOS, Flutter path_provider's getApplicationSupportDirectory() goes to ~/Library/Application Support/<bundle_id>
    // Let's actually check the standard path_provider locations.
    // Wait, on Mac path_provider uses `~/Library/Application Support/com.webziggy.sonosCompanion` by default unless we configured it differently.
    // To make it simple, let's just assume we'll update the Flutter code to write to exactly `~/.sonos_companion_auth.json` using standard Dart `Platform.environment['HOME']`.
    // That avoids platform-specific path_provider quirkiness for a hidden file!
    const simplePath = path.join(os.homedir(), ".sonos_companion_auth.json");

    if (fs.existsSync(simplePath)) {
      const data = fs.readFileSync(simplePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    // Companion app not running or auth file invalid
  }
  return null;
}

export async function isCompanionActive(): Promise<boolean> {
  const auth = getAuthDetails();
  if (!auth) return false;

  try {
    const res = await fetch(`http://127.0.0.1:${auth.port}/health`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function notifyCompanion(payload: any): Promise<void> {
  const auth = getAuthDetails();
  if (!auth) return;

  try {
    await fetch(`http://127.0.0.1:${auth.port}/notify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {}
}

export async function sendConfigToCompanion(
  haUrl: string,
  haToken: string,
): Promise<void> {
  const auth = getAuthDetails();
  if (!auth) return;

  try {
    await fetch(`http://127.0.0.1:${auth.port}/config`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ haUrl, haToken }),
    });
  } catch (e) {}
}

export async function getCompanionSleepTimer(
  speakerName: string,
): Promise<string | null> {
  const auth = getAuthDetails();
  if (!auth) return null;

  try {
    const res = await fetch(
      `http://127.0.0.1:${auth.port}/sleep-timer?speaker=${encodeURIComponent(speakerName)}`,
      {
        headers: { Authorization: `Bearer ${auth.token}` },
      },
    );

    if (res.ok) {
      const data = await res.json();
      return data.remaining || null; // e.g. "00:15:00"
    }
  } catch (e) {}
  return null;
}

export async function getCompanionHistory(): Promise<any[]> {
  const auth = getAuthDetails();
  if (!auth) return [];
  try {
    const res = await fetch(`http://127.0.0.1:${auth.port}/history`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      return data.history || [];
    }
  } catch (e) {}
  return [];
}

export async function syncFiltersToCompanion(
  allowlist: string[],
  blocklist: string[],
): Promise<void> {
  const auth = getAuthDetails();
  if (!auth) return;
  try {
    await fetch(`http://127.0.0.1:${auth.port}/filters`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ allowlist, blocklist }),
    });
  } catch (e) {}
}

export async function getCompanionDebugStates(): Promise<any[]> {
  const auth = getAuthDetails();
  if (!auth) return [];
  try {
    const res = await fetch(`http://127.0.0.1:${auth.port}/debug_states`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (res.ok) {
      return (await res.json()) as any[];
    }
  } catch (e) {}
  return [];
}

export async function getObservedStations(): Promise<
  Record<string, { title: string; artist: string }>
> {
  const auth = getAuthDetails();
  if (!auth) return {};
  try {
    const res = await fetch(`http://127.0.0.1:${auth.port}/observed_stations`);
    if (res.ok) {
      return (await res.json()) as Record<
        string,
        { title: string; artist: string }
      >;
    }
  } catch (e) {}
  return {};
}

export async function getStationConfig(): Promise<Record<string, any>> {
  const localStr = await LocalStorage.getItem<string>("stationConfig");
  if (localStr) {
    try {
      return JSON.parse(localStr);
    } catch (e) {}
  }
  return {};
}

export async function saveStationConfig(
  config: Record<string, any>,
): Promise<void> {
  await LocalStorage.setItem("stationConfig", JSON.stringify(config));
  const auth = getAuthDetails();
  if (!auth) return;
  try {
    await fetch(`http://127.0.0.1:${auth.port}/station_config`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });
  } catch (e) {}
}

export async function syncPinnedSpeakerToCompanion(
  speaker: string | undefined,
): Promise<void> {
  const auth = getAuthDetails();
  if (!auth) return;
  try {
    await fetch(`http://127.0.0.1:${auth.port}/pinned_speaker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ speaker: speaker || "" }),
    });
  } catch (e) {}
}
