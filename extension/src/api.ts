import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  HassEntities,
  Connection,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
} from "home-assistant-js-websocket";
import WebSocket from "ws";
import { getPreferenceValues } from "@raycast/api";

(global as any).WebSocket = WebSocket;

export interface Preferences {
  haUrlLocal?: string;
  haUrl: string;
  haToken: string;
  defaultSpeaker?: string;
  includeEntities?: string;
  flashTrackName?: boolean;
  debugLogging?: boolean;
}

let connectionPromise: Promise<Connection> | null = null;
let activeBaseUrl = "";

async function resolveActiveUrl(
  localUrl: string | undefined,
  externalUrl: string,
  token: string,
): Promise<string> {
  const ext = externalUrl.trim().replace(/\/+$/, "");
  if (localUrl && localUrl.trim() !== "") {
    const loc = localUrl.trim().replace(/\/+$/, "");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout
      const res = await fetch(`${loc}/api/`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        if (getPreferenceValues<Preferences>().debugLogging)
          console.log(`[DEBUG] Connected to Local HA URL: ${loc}`);
        return loc;
      }
    } catch (e) {
      if (getPreferenceValues<Preferences>().debugLogging)
        console.log(
          `[DEBUG] Local HA URL unreachable, falling back to external...`,
        );
    }
  }
  return ext;
}

export async function getActiveHaUrl(): Promise<string> {
  if (activeBaseUrl) return activeBaseUrl;
  const prefs = getPreferenceValues<Preferences>();
  activeBaseUrl = await resolveActiveUrl(
    prefs.haUrlLocal,
    prefs.haUrl,
    prefs.haToken,
  );
  return activeBaseUrl;
}

export async function getHAConnection(): Promise<Connection> {
  if (connectionPromise) {
    return connectionPromise;
  }

  const preferences = getPreferenceValues<Preferences>();
  activeBaseUrl = await resolveActiveUrl(
    preferences.haUrlLocal,
    preferences.haUrl,
    preferences.haToken,
  );
  const auth = createLongLivedTokenAuth(activeBaseUrl, preferences.haToken);

  connectionPromise = createConnection({ auth }).catch((err) => {
    connectionPromise = null;
    if (err === ERR_CANNOT_CONNECT) {
      throw new Error(
        `Cannot connect to Home Assistant at ${baseUrl}. Check your URL and network.`,
      );
    }
    if (err === ERR_INVALID_AUTH) {
      throw new Error("Invalid Long-Lived Access Token.");
    }
    throw new Error(`Connection failed: ${err}`);
  });

  return connectionPromise;
}

export async function callService(
  domain: string,
  service: string,
  serviceData: Record<string, any> = {},
) {
  const connection = await getHAConnection();
  return connection.sendMessagePromise({
    type: "call_service",
    domain,
    service,
    service_data: serviceData,
  });
}

export async function fetchFavourites(
  entityId: string,
  contentType: string = "favorites",
  contentId: string = "",
) {
  const connection = await getHAConnection();
  return connection.sendMessagePromise({
    type: "media_player/browse_media",
    entity_id: entityId,
    media_content_type: contentType,
    media_content_id: contentId,
  });
}

export async function fetchQueue(entityId: string) {
  const connection = await getHAConnection();
  return connection.sendMessagePromise({
    type: "call_service",
    domain: "sonos",
    service: "get_queue",
    target: {
      entity_id: entityId,
    },
    return_response: true,
  });
}

export function getFullImageUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const preferences = getPreferenceValues<Preferences>();
  // We cannot await here, so we'll just optimistically use the external URL for images if it hasn't been cached,
  // though typically activeBaseUrl is initialized immediately on boot.
  const baseUrl = activeBaseUrl || preferences.haUrl.trim().replace(/\/+$/, "");
  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function filterSonosPlayers(entities: HassEntities) {
  const prefs = getPreferenceValues<Preferences>();
  const allowedIds = prefs.includeEntities
    ? prefs.includeEntities
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];

  return Object.values(entities).filter((e) => {
    if (!e.entity_id.startsWith("media_player.")) return false;
    if (allowedIds.length > 0)
      return allowedIds.includes(e.entity_id.toLowerCase());

    // Heuristic: Only Sonos players have group_members populated by the integration
    return e.attributes?.group_members !== undefined;
  });
}

export function sortPlayers(players: any[]) {
  const prefs = getPreferenceValues<Preferences>();
  const defaultId = prefs.defaultSpeaker?.trim().toLowerCase();

  if (!defaultId) return players;

  return [...players].sort((a, b) => {
    if (a.entity_id.toLowerCase() === defaultId) return -1;
    if (b.entity_id.toLowerCase() === defaultId) return 1;
    return 0;
  });
}

export function getGroupedPlayers(players: any[]) {
  const groups = new Map<string, { coordinator: any; members: any[] }>();

  players.forEach((p) => {
    const groupMembers = p.attributes?.group_members || [p.entity_id];
    const coordinatorId = groupMembers[0];

    if (!groups.has(coordinatorId)) {
      groups.set(coordinatorId, { coordinator: null, members: [] });
    }

    const group = groups.get(coordinatorId)!;
    if (p.entity_id === coordinatorId) {
      group.coordinator = p;
    }
    group.members.push(p);
  });

  return Array.from(groups.values())
    .filter((g) => g.coordinator)
    .map((g) => {
      const coordinatorName =
        g.coordinator.attributes?.friendly_name || g.coordinator.entity_id;
      const memberNames = g.members
        .filter((m) => m.entity_id !== g.coordinator.entity_id)
        .map((m) => m.attributes?.friendly_name || m.entity_id);

      const groupName =
        memberNames.length > 0
          ? `${coordinatorName} (+ ${memberNames.join(", ")})`
          : coordinatorName;

      return {
        ...g.coordinator,
        groupName,
        isGroup: memberNames.length > 0,
        groupMembers: g.members,
      };
    });
}
