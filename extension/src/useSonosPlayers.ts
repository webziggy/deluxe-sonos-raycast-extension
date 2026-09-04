import { useState, useEffect, useRef } from "react";
import { Cache, getPreferenceValues } from "@raycast/api";
import { getHAConnection, filterSonosPlayers, getGroupedPlayers } from "./api";
import { subscribeEntities } from "home-assistant-js-websocket";
import { isCompanionActive, notifyCompanion } from "./companionClient";

const cache = new Cache();

interface UseSonosPlayersResult {
  players: any[];
  isLoading: boolean;
  error?: string;
  companionActive: boolean;
  sleepTimers: Record<string, string>;
}

export function useSonosPlayers(): UseSonosPlayersResult {
  const [players, setPlayers] = useState<any[]>(() => {
    const cached = cache.get("sonosPlayers");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(!cache.has("sonosPlayers"));
  const [error, setError] = useState<string>();
  const [companionActive, setCompanionActive] = useState<boolean>(false);
  const [sleepTimers, setSleepTimers] = useState<Record<string, string>>({});

  const lastJsonRef = useRef(cache.get("sonosPlayers") || "");

  useEffect(() => {
    isCompanionActive().then((isActive) => {
      setCompanionActive(isActive);
      if (isActive) {
        console.log("Sonos Companion App detected and active!");
        const prefs = getPreferenceValues();
        import("./companionClient").then(({ sendConfigToCompanion }) => {
          sendConfigToCompanion(prefs.haUrl, prefs.haToken);
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!companionActive || players.length === 0) return;

    // We only poll root players to save network spam
    const rootPlayers = filterSonosPlayers(players as any);

    const pollTimers = async () => {
      const newTimers: Record<string, string> = {};
      import("./companionClient").then(async ({ getCompanionSleepTimer }) => {
        for (const p of rootPlayers) {
          const name = p.attributes?.friendly_name;
          if (name) {
            const timer = await getCompanionSleepTimer(name);
            if (timer) newTimers[p.entity_id] = timer;
          }
        }
        setSleepTimers(newTimers);
      });
    };

    pollTimers();
    const interval = setInterval(pollTimers, 10000);
    return () => clearInterval(interval);
  }, [companionActive, players]);

  useEffect(() => {
    let unsubscribe: () => void;
    let heartbeat: NodeJS.Timeout;

    getHAConnection()
      .then((connection) => {
        unsubscribe = subscribeEntities(connection, (newEntities) => {
          const sonosPlayers = filterSonosPlayers(newEntities);
          const groupedPlayers = getGroupedPlayers(sonosPlayers);

          groupedPlayers.forEach((player) => {
            const baseName = player.entity_id.split(".")[1];
            const nightSound = newEntities[`switch.${baseName}_night_sound`];
            const speechEnhancement =
              newEntities[`switch.${baseName}_speech_enhancement`];

            if (nightSound) {
              player.nightSound = nightSound.state === "on";
              player.nightSoundEntityId = nightSound.entity_id;
            }
            if (speechEnhancement) {
              player.speechEnhancement = speechEnhancement.state === "on";
              player.speechEnhancementEntityId = speechEnhancement.entity_id;
            }

            if (baseName === "bedroomsonos" || baseName === "bedroom") {
              console.log(
                "[DEBUG PLAYER ATTRS KEYS]:",
                Object.keys(
                  newEntities[player.entity_id]?.attributes || {},
                ).join(", "),
              );
              console.log(
                "[DEBUG ALL SLEEP ENTITIES]:",
                Object.keys(newEntities)
                  .filter((k) => k.includes("sleep") || k.includes("timer"))
                  .join(", "),
              );
            }

            // Sniff for EQ Settings
            player.eq = {};
            [
              "bass",
              "treble",
              "sub_gain",
              "surround_level",
              "audio_delay",
            ].forEach((eqType) => {
              const eqEntity = newEntities[`number.${baseName}_${eqType}`];
              if (eqEntity) {
                player.eq[eqType] = {
                  entity_id: eqEntity.entity_id,
                  value: Number(eqEntity.state),
                  min: Number(eqEntity.attributes.min ?? -10),
                  max: Number(eqEntity.attributes.max ?? 10),
                  step: Number(eqEntity.attributes.step ?? 1),
                };
              }
            });

            const loudness = newEntities[`switch.${baseName}_loudness`];
            if (loudness) {
              player.eq.loudness = {
                entity_id: loudness.entity_id,
                state: loudness.state === "on",
              };
            }

            // Sniff for Sleep Timer
            const sleepTimer = newEntities[`sensor.${baseName}_sleep_timer`];
            if (
              sleepTimer &&
              sleepTimer.state !== "unavailable" &&
              sleepTimer.state !== "idle"
            ) {
              player.sleepTimer = sleepTimer.state; // Could be timestamp or remaining duration
            }
          });

          const currentJson = JSON.stringify(groupedPlayers);

          if (currentJson !== lastJsonRef.current) {
            const prefs = getPreferenceValues<{ debugLogging?: boolean }>();
            if (prefs.debugLogging)
              console.log(
                new Date().toISOString(),
                "[DEBUG]",
                "Sonos state changed, triggering React update.",
              );

            lastJsonRef.current = currentJson;
            setPlayers(groupedPlayers);
            cache.set("sonosPlayers", currentJson);
          }
          setIsLoading(false);
        });

        // Lightweight Heartbeat to prevent silent drops
        heartbeat = setInterval(() => {
          if (connection.socket && connection.socket.readyState === 1) {
            // WebSocket.OPEN
            connection.sendMessagePromise({ type: "ping" }).catch(() => {
              console.log("[DEBUG] Ping failed, forcing reconnect.");
              connection.socket?.close(); // Forces home-assistant-js-websocket to automatically reconnect
            });
          }
        }, 30000);
      })
      .catch((err) => {
        console.error(err);
        setError(String(err));
        setIsLoading(false);
      });

    return () => {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return { players, isLoading, error, companionActive, sleepTimers };
}
