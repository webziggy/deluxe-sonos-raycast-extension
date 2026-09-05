import {
  syncPinnedSpeakerToCompanion,
  syncFiltersToCompanion,
  saveStationConfig,
} from "./companionClient";
import {
  MenuBarExtra,
  openCommandPreferences,
  Icon,
  Cache,
  getPreferenceValues,
  open,
  launchCommand,
  LaunchType,
  showHUD,
  LocalStorage,
} from "@raycast/api";
import { useEffect, useState, useRef, Fragment } from "react";
import { callService, Preferences } from "./api";
import { useSonosPlayers } from "./useSonosPlayers";

const cache = new Cache();

export default function Command() {
  const prefs = getPreferenceValues<Preferences>();

  const [pinnedSpeaker, setPinnedSpeaker] = useState<string | undefined>(
    cache.get("pinnedSpeaker"),
  );
  const [pinTrackName, setPinTrackName] = useState<boolean>(
    cache.get("pinTrackName") === "true",
  );

  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [structuredFavourites, setStructuredFavourites] = useState<{ title: string; items: any[] }[]>([]);
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const cached = cache.get("favourites");
        if (cached) {
          const parsed = JSON.parse(cached);
          setStructuredFavourites(parsed);
        }
      } catch (e) {}
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Sync the initial pinned speaker to the companion app so it knows right away
    syncPinnedSpeakerToCompanion(cache.get("pinnedSpeaker"));
    Promise.all([
      LocalStorage.getItem<string>("allowlist"),
      LocalStorage.getItem<string>("blocklist"),
      LocalStorage.getItem<string>("stationConfig"),
    ]).then(([a, b, cStr]) => {
      const aList = a
        ? a
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];
      const bList = b
        ? b
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];
      syncFiltersToCompanion(aList, bList);

      if (cStr) {
        try {
          const configObj = JSON.parse(cStr);
          saveStationConfig(configObj);
        } catch (e) {}
      }
    });
  }, []);
  useEffect(() => {
    LocalStorage.getItem<string>("allowlist").then((a) => {
      if (a)
        setAllowlist(
          a
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        );
    });
    LocalStorage.getItem<string>("blocklist").then((b) => {
      if (b)
        setBlocklist(
          b
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        );
    });
  }, []);

  const debugLog = (...args: any[]) => {
    if (prefs.debugLogging)
      console.log(new Date().toISOString(), "[DEBUG]", ...args);
  };

  const wrapText = (text: string, maxLength: number): string[] => {
    if (text.length <= maxLength) return [text];

    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      // If a single word is absurdly long, we just have to break it
      if (word.length > maxLength) {
        if (currentLine) lines.push(currentLine);
        lines.push(word.substring(0, maxLength - 3) + "...");
        currentLine = "";
        continue;
      }

      if (currentLine.length + word.length + 1 > maxLength) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const {
    players: allPlayers,
    isLoading,
    error,
    companionActive,
    sleepTimers,
  } = useSonosPlayers();

  // Use absolute time to avoid macOS App Nap freezing our timers

  const sortedPlayers = [...allPlayers].sort((a, b) => {
    if (a.entity_id === pinnedSpeaker) return -1;
    if (b.entity_id === pinnedSpeaker) return 1;
    return 0;
  });

  const defaultPlayer = pinnedSpeaker
    ? allPlayers.find((p) => p.entity_id === pinnedSpeaker)
    : null;
  const otherPlayers = defaultPlayer
    ? allPlayers.filter((p) => p.entity_id !== defaultPlayer.entity_id)
    : sortedPlayers;

  const primaryPlayer = defaultPlayer || sortedPlayers[0];
  const currentTrack =
    primaryPlayer?.state === "playing"
      ? [
          primaryPlayer.attributes?.media_title,
          primaryPlayer.attributes?.media_artist,
        ]
          .filter(Boolean)
          .join(" - ")
      : null;

  const [trackHistories, setTrackHistories] = useState<
    Record<string, { track: string; timestamp: number }[]>
  >(() => {
    try {
      return JSON.parse(cache.get("trackHistories") || "{}");
    } catch (e) {
      return {};
    }
  });

  const lastTracksRef = useRef<Record<string, string>>(
    (() => {
      try {
        return JSON.parse(cache.get("lastTracks") || "{}");
      } catch (e) {
        return {};
      }
    })(),
  );

  const [lastFavourites, setLastFavourites] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(cache.get("lastFavourites") || "{}");
    } catch (e) {
      return {};
    }
  });

  const lastFavouritesRef = useRef<Record<string, string>>(lastFavourites);

  // Monitor ALL speakers for track changes to trigger History
  useEffect(() => {
    let triggeredChange = false;

    for (const player of allPlayers) {
      const trackString =
        player.state === "playing"
          ? [player.attributes?.media_title, player.attributes?.media_artist]
              .filter(Boolean)
              .join(" - ")
          : "";

      if (
        trackString &&
        trackString !== lastTracksRef.current[player.entity_id]
      ) {
        // Add to history if it's not empty
        if (trackString !== "Idle" && trackString !== "Offline") {
          setTrackHistories((prev) => {
            const currentHistory = prev[player.entity_id] || [];
            // Prevent rapid back-to-back duplicates for the same speaker
            if (
              currentHistory.length > 0 &&
              currentHistory[0].track === trackString
            ) {
              return prev;
            }
            const newHistory = [
              { track: trackString, timestamp: Date.now() },
              ...currentHistory,
            ].slice(0, 10);
            const nextState = { ...prev, [player.entity_id]: newHistory };
            cache.set("trackHistories", JSON.stringify(nextState));

            return nextState;
          });
        }
        triggeredChange = true;
      }
      lastTracksRef.current[player.entity_id] = trackString;

      const source = player.attributes?.source;
      const channel = player.attributes?.media_channel;
      const favouriteString = source || channel;
      
      if (
        favouriteString &&
        favouriteString !== lastFavouritesRef.current[player.entity_id]
      ) {
         setLastFavourites((prev) => {
            const nextState = { ...prev, [player.entity_id]: favouriteString };
            cache.set("lastFavourites", JSON.stringify(nextState));
            return nextState;
         });
         lastFavouritesRef.current[player.entity_id] = favouriteString;
      }
    }

    if (triggeredChange) {
      cache.set("lastTracks", JSON.stringify(lastTracksRef.current));
    }
  }, [allPlayers]);

  const handlePlayPause = async (entityId: string) => {
    await callService("media_player", "media_play_pause", {
      entity_id: entityId,
    });
  };

  const handleNext = async (entityId: string) => {
    await callService("media_player", "media_next_track", {
      entity_id: entityId,
    });
  };

  const handlePrevious = async (entityId: string) => {
    await callService("media_player", "media_previous_track", {
      entity_id: entityId,
    });
  };

  const handleVolumeChange = async (members: any[], change: number) => {
    for (const member of members) {
      const currentVolume = member.attributes?.volume_level || 0;
      const newVolume = Math.max(0, Math.min(1, currentVolume + change));
      await callService("media_player", "volume_set", {
        entity_id: member.entity_id,
        volume_level: newVolume,
      });
    }
  };

  const handleSetExactVolume = async (members: any[], volume: number) => {
    for (const member of members) {
      await callService("media_player", "volume_set", {
        entity_id: member.entity_id,
        volume_level: volume,
      });
    }
  };

  const handleToggleMute = async (
    members: any[],
    isCurrentlyMuted: boolean,
  ) => {
    for (const member of members) {
      await callService("media_player", "volume_mute", {
        entity_id: member.entity_id,
        is_volume_muted: !isCurrentlyMuted,
      });
    }
  };

  const handleSelectSource = async (entityId: string, source: string) => {
    await callService("media_player", "select_source", {
      entity_id: entityId,
      source,
    });
  };

  const handlePinSpeaker = async (entityId: string) => {
    cache.set("pinnedSpeaker", entityId);
    setPinnedSpeaker(entityId);
    await syncPinnedSpeakerToCompanion(entityId);
  };

  const handleUnpinSpeaker = async () => {
    cache.remove("pinnedSpeaker");
    setPinnedSpeaker(undefined);
    await syncPinnedSpeakerToCompanion(undefined);
  };

  const renderExactVolumeSubmenu = (
    members: any[],
    title = "Set Exact Volume",
  ) => (
    <MenuBarExtra.Submenu title={title} icon={Icon.Speaker}>
      {Array.from({ length: 10 }, (_, i) => i * 10).map((tens) => (
        <MenuBarExtra.Submenu key={tens} title={`${tens}% - ${tens + 9}%`}>
          {Array.from({ length: 10 }, (_, i) => tens + i).map((vol) => (
            <MenuBarExtra.Item
              key={vol}
              title={`Set Volume to ${vol}%`}
              onAction={() => handleSetExactVolume(members, vol / 100)}
            />
          ))}
        </MenuBarExtra.Submenu>
      ))}
      <MenuBarExtra.Item
        title="Set Volume to 100%"
        onAction={() => handleSetExactVolume(members, 1)}
      />
    </MenuBarExtra.Submenu>
  );

  const renderPlayerControls = (player: any, isRoot = false) => {
    const title = player.groupName;
    const state = player.state;
    const mediaTitle = player.attributes?.media_title;
    const mediaArtist = player.attributes?.media_artist;
    const sourceList: string[] = player.attributes?.source_list || [];

    const avgVolume =
      player.groupMembers.reduce(
        (sum: number, m: any) => sum + (m.attributes?.volume_level || 0),
        0,
      ) / player.groupMembers.length;
    const isMuted = player.groupMembers.some(
      (m: any) => m.attributes?.is_volume_muted,
    );

    const maxLen = 60;
    let fullNowPlaying = "Idle";
    let nowPlayingLines = ["Idle"];

    if (state === "playing" || state === "paused") {
      fullNowPlaying =
        [mediaTitle, mediaArtist].filter(Boolean).join(" - ") ||
        "Unknown Media";

      const evalString = `${mediaTitle || ""} on ${player.attributes?.friendly_name || ""}`;
      let allowed = true;
      if (allowlist.length > 0) {
        allowed = allowlist.some((r) => new RegExp(r, "i").test(evalString));
      }
      if (allowed && blocklist.length > 0) {
        if (blocklist.some((r) => new RegExp(r, "i").test(evalString))) {
          allowed = false;
        }
      }

      if (!allowed) {
        fullNowPlaying = "Nothing playing";
        nowPlayingLines = [fullNowPlaying];
      } else {
        nowPlayingLines = wrapText(fullNowPlaying, maxLen);
      }
    } else if (state === "unavailable" || state === "unknown") {
      fullNowPlaying = "Offline";
      nowPlayingLines = ["Offline"];
    }

    const stateIcon =
      state === "playing"
        ? Icon.Play
        : state === "paused"
          ? Icon.Pause
          : state === "unavailable" || state === "unknown"
            ? Icon.WifiDisabled
            : Icon.Stop;

    const transparentIcon =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    const activeFavourite = player.attributes?.source || player.attributes?.media_channel;
    
    const content = (
      <>
        {isRoot && <MenuBarExtra.Item title={title} icon={Icon.Speaker} />}
        
        {(state === "playing" || state === "paused") && activeFavourite && activeFavourite !== mediaTitle && activeFavourite !== mediaArtist && (
            <MenuBarExtra.Item title={`\u2800${activeFavourite}`} />
        )}
        
        {nowPlayingLines.map((line, index) => (
          <MenuBarExtra.Item
            key={`nowPlaying-${index}`}
            title={`\u2800${line}`}
            icon={
              isRoot ? (index === 0 ? stateIcon : transparentIcon) : undefined
            }
            onAction={
              fullNowPlaying !== "Idle" && fullNowPlaying !== "Offline" && fullNowPlaying !== "Nothing playing"
                ? () =>
                    open(
                      `https://www.google.com/search?q=${encodeURIComponent(fullNowPlaying)}`,
                    )
                : undefined
            }
          />
        ))}        
        {!isRoot && <MenuBarExtra.Item title={`State: ${state}`} />}

        <MenuBarExtra.Section title="Controls">
          {(fullNowPlaying === "Idle" || fullNowPlaying === "Nothing playing" || state === "paused") && lastFavourites[player.entity_id] && (
            <MenuBarExtra.Item
              title={`Play Last: ${lastFavourites[player.entity_id]}`}
              icon={Icon.Play}
              onAction={async () => {
                await callService("media_player", "select_source", {
                  entity_id: player.entity_id,
                  source: lastFavourites[player.entity_id],
                });
              }}
            />
          )}
          <MenuBarExtra.Item
            title={state === "playing" ? "Pause" : "Play"}
            icon={state === "playing" ? Icon.Pause : Icon.Play}
            shortcut={isRoot ? { modifiers: ["cmd"], key: "p" } : undefined}
            onAction={() => handlePlayPause(player.entity_id)}
          />
          <MenuBarExtra.Item
            title="Next Track"
            icon={Icon.Forward}
            shortcut={
              isRoot ? { modifiers: ["cmd"], key: "arrowRight" } : undefined
            }
            onAction={() => handleNext(player.entity_id)}
          />
          <MenuBarExtra.Item
            title="Previous Track"
            icon={Icon.Rewind}
            shortcut={
              isRoot ? { modifiers: ["cmd"], key: "arrowLeft" } : undefined
            }
            onAction={() => handlePrevious(player.entity_id)}
          />
          <MenuBarExtra.Item
            title="Open Queue..."
            icon={Icon.List}
            shortcut={isRoot ? { modifiers: ["cmd"], key: "o" } : undefined}
            onAction={() =>
              launchCommand({
                name: "queue",
                type: LaunchType.UserInitiated,
                context: { entityId: player.entity_id },
              })
            }
          />
          {player.attributes?.shuffle !== undefined && (
            <MenuBarExtra.Item
              title={`Shuffle: ${player.attributes.shuffle ? "On" : "Off"}`}
              icon={Icon.Shuffle}
              onAction={() =>
                callService("media_player", "shuffle_set", {
                  entity_id: player.entity_id,
                  shuffle: !player.attributes.shuffle,
                })
              }
            />
          )}
          {player.attributes?.repeat !== undefined && (
            <MenuBarExtra.Item
              title={`Repeat: ${player.attributes.repeat.charAt(0).toUpperCase() + player.attributes.repeat.slice(1)}`}
              icon={Icon.Repeat}
              onAction={() => {
                const nextRepeat =
                  player.attributes.repeat === "off"
                    ? "all"
                    : player.attributes.repeat === "all"
                      ? "one"
                      : "off";
                callService("media_player", "repeat_set", {
                  entity_id: player.entity_id,
                  repeat: nextRepeat,
                });
              }}
            />
          )}
        </MenuBarExtra.Section>

        {(trackHistories[player.entity_id] || []).length > 0 && (
          <MenuBarExtra.Section>
            <MenuBarExtra.Submenu title="Recently Played" icon={Icon.Clock}>
              {(trackHistories[player.entity_id] || []).map((item, i) => {
                const displayLines = wrapText(item.track, 60);
                return (
                  <MenuBarExtra.Section key={i}>
                    {displayLines.map((line, lineIdx) => (
                      <MenuBarExtra.Item
                        key={`${i}-${lineIdx}`}
                        title={`\u2800${line}`}
                        subtitle={
                          lineIdx === 0
                            ? new Date(item.timestamp).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : undefined
                        }
                        onAction={() =>
                          open(
                            `https://www.google.com/search?q=${encodeURIComponent(item.track)}`,
                          )
                        }
                      />
                    ))}
                  </MenuBarExtra.Section>
                );
              })}
            </MenuBarExtra.Submenu>
          </MenuBarExtra.Section>
        )}

        <MenuBarExtra.Section
          title={`Group Volume (${Math.round(avgVolume * 100)}%)`}
        >
          <MenuBarExtra.Item
            title={isMuted ? "Unmute" : "Mute"}
            icon={isMuted ? Icon.SpeakerOn : Icon.SpeakerOff}
            shortcut={isRoot ? { modifiers: ["cmd"], key: "m" } : undefined}
            onAction={() => handleToggleMute(player.groupMembers, isMuted)}
          />
          <MenuBarExtra.Item
            title="Volume +5%"
            icon={Icon.SpeakerUp}
            shortcut={isRoot ? { modifiers: ["cmd"], key: "+" } : undefined}
            onAction={() => handleVolumeChange(player.groupMembers, 0.05)}
          />
          <MenuBarExtra.Item
            title="Volume -5%"
            icon={Icon.SpeakerDown}
            shortcut={isRoot ? { modifiers: ["cmd"], key: "-" } : undefined}
            onAction={() => handleVolumeChange(player.groupMembers, -0.05)}
          />
          {renderExactVolumeSubmenu(player.groupMembers)}

          {player.groupMembers.length > 1 && (
            <>
              {player.groupMembers.map((m: any) => {
                const vol = Math.round((m.attributes?.volume_level || 0) * 100);
                const indMuted = m.attributes?.is_volume_muted;
                return (
                  <MenuBarExtra.Submenu
                    key={m.entity_id}
                    title={`${m.attributes?.friendly_name} (${vol}%)`}
                    icon={Icon.Speaker}
                  >
                    <MenuBarExtra.Item
                      title={indMuted ? "Unmute" : "Mute"}
                      icon={indMuted ? Icon.SpeakerOn : Icon.SpeakerOff}
                      onAction={() => handleToggleMute([m], indMuted)}
                    />
                    <MenuBarExtra.Item
                      title="Volume +5%"
                      icon={Icon.SpeakerUp}
                      onAction={() => handleVolumeChange([m], 0.05)}
                    />
                    <MenuBarExtra.Item
                      title="Volume -5%"
                      icon={Icon.SpeakerDown}
                      onAction={() => handleVolumeChange([m], -0.05)}
                    />
                    {renderExactVolumeSubmenu([m])}
                  </MenuBarExtra.Submenu>
                );
              })}
            </>
          )}
        </MenuBarExtra.Section>

        {(player.nightSoundEntityId || player.speechEnhancementEntityId) && (
          <MenuBarExtra.Section title="Home Theater">
            {player.nightSoundEntityId && (
              <MenuBarExtra.Item
                title={
                  player.nightSound ? "Night Sound: On" : "Night Sound: Off"
                }
                icon={player.nightSound ? Icon.Moon : Icon.Sun}
                onAction={() =>
                  callService("switch", "toggle", {
                    entity_id: player.nightSoundEntityId,
                  })
                }
              />
            )}
            {player.speechEnhancementEntityId && (
              <MenuBarExtra.Item
                title={
                  player.speechEnhancement
                    ? "Speech Enhancement: On"
                    : "Speech Enhancement: Off"
                }
                icon={
                  player.speechEnhancement
                    ? Icon.SpeechBubbleActive
                    : Icon.SpeechBubble
                }
                onAction={() =>
                  callService("switch", "toggle", {
                    entity_id: player.speechEnhancementEntityId,
                  })
                }
              />
            )}
          </MenuBarExtra.Section>
        )}

        <MenuBarExtra.Section>
          {(Array.isArray(structuredFavourites) ? structuredFavourites : []).length > 0 ? (
            <MenuBarExtra.Submenu title="Favourites" icon={Icon.Star}>
              {(Array.isArray(structuredFavourites) ? structuredFavourites : []).map((section: any) => (
                <MenuBarExtra.Submenu key={section.title} title={section.title || "Unknown"}>
                  {(Array.isArray(section.items) ? section.items : []).map((fav: any, index: number) => (
                    <MenuBarExtra.Item
                      key={`${fav.media_content_id || fav.title}-${index}`}
                      title={fav.title || "Unknown"}
                      onAction={() => handleSelectSource(player.entity_id, fav.title)}
                    />
                  ))}
                </MenuBarExtra.Submenu>
              ))}
            </MenuBarExtra.Submenu>
          ) : sourceList.length > 0 ? (
            <MenuBarExtra.Submenu title="Favourites" icon={Icon.Star}>
              {sourceList.map((source) => (
                <MenuBarExtra.Item
                  key={source}
                  title={source}
                  onAction={() => handleSelectSource(player.entity_id, source)}
                />
              ))}
            </MenuBarExtra.Submenu>
          ) : null}
          <MenuBarExtra.Item
            title="Open Favourites Grid..."
            icon={Icon.AppWindowGrid3x3}
            shortcut={isRoot ? { modifiers: ["cmd"], key: "f" } : undefined}
            onAction={() =>
              launchCommand({
                name: "favourites",
                type: LaunchType.UserInitiated,
                context: { entityId: player.entity_id },
              })
            }
          />
        </MenuBarExtra.Section>

        <MenuBarExtra.Section>
          <MenuBarExtra.Submenu title="Set Sleep Timer..." icon={Icon.Clock}>
            {[15, 30, 45, 60, 90, 120].map((mins) => (
              <MenuBarExtra.Item
                key={mins}
                title={`${mins} Minutes`}
                onAction={async () => {
                  await callService("sonos", "set_sleep_timer", {
                    entity_id: player.entity_id,
                    sleep_time: mins * 60,
                  });
                  await showHUD(`💤 Sleep timer set for ${mins} minutes`);
                }}
              />
            ))}
          </MenuBarExtra.Submenu>

          {sleepTimers[player.entity_id] && (
            <MenuBarExtra.Item
              title={`Sleep Timer Active: ${sleepTimers[player.entity_id]}`}
              icon={Icon.Stopwatch}
            />
          )}

          <MenuBarExtra.Item
            title="Clear Sleep Timer"
            icon={Icon.Trash}
            onAction={async () => {
              await callService("sonos", "clear_sleep_timer", {
                entity_id: player.entity_id,
              });
              await showHUD("☀️ Sleep timer cleared");
            }}
          />

          {player.eq && Object.keys(player.eq).length > 0 && (
            <MenuBarExtra.Submenu
              title="Audio Settings..."
              icon={Icon.LevelMeter}
            >
              {[
                "bass",
                "treble",
                "sub_gain",
                "surround_level",
                "audio_delay",
              ].map((eqType) => {
                const eq = player.eq[eqType];
                if (!eq) return null;
                const name = eqType
                  .split("_")
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(" ");
                return (
                  <MenuBarExtra.Submenu
                    key={eqType}
                    title={`${name}: ${eq.value}`}
                    icon={Icon.LevelMeter}
                  >
                    {Array.from(
                      {
                        length:
                          Math.floor((eq.max - eq.min) / (eq.step || 1)) + 1,
                      },
                      (_, i) => eq.min + i * (eq.step || 1),
                    )
                      .filter(
                        (v) => v % 2 === 0 || v === eq.max || v === eq.min,
                      )
                      .reverse()
                      .map((val) => (
                        <MenuBarExtra.Item
                          key={val}
                          title={`Set to ${val > 0 ? "+" : ""}${val}${val === 0 ? " (Default)" : ""}`}
                          onAction={() =>
                            callService("number", "set_value", {
                              entity_id: eq.entity_id,
                              value: val,
                            })
                          }
                        />
                      ))}
                  </MenuBarExtra.Submenu>
                );
              })}
              {player.eq.loudness && (
                <MenuBarExtra.Item
                  title={`Loudness: ${player.eq.loudness.state ? "On" : "Off"}`}
                  icon={
                    player.eq.loudness.state ? Icon.SpeakerOn : Icon.SpeakerOff
                  }
                  onAction={() =>
                    callService("switch", "toggle", {
                      entity_id: player.eq.loudness.entity_id,
                    })
                  }
                />
              )}
            </MenuBarExtra.Submenu>
          )}
        </MenuBarExtra.Section>

        <MenuBarExtra.Section>
          <MenuBarExtra.Submenu title="Group With..." icon={Icon.Plus}>
            <MenuBarExtra.Item
              title="Group All (Party Mode)"
              icon={Icon.Music}
              shortcut={isRoot ? { modifiers: ["cmd"], key: "g" } : undefined}
              onAction={() => {
                const others = allPlayers
                  .filter((p) => p.entity_id !== player.entity_id)
                  .map((p) => p.entity_id);
                if (others.length > 0) {
                  callService("media_player", "join", {
                    entity_id: player.entity_id,
                    group_members: others,
                  });
                }
              }}
            />
            {allPlayers
              .filter((p) => p.entity_id !== player.entity_id)
              .map((other) => (
                <MenuBarExtra.Item
                  key={other.entity_id}
                  title={other.groupName}
                  onAction={() =>
                    callService("media_player", "join", {
                      entity_id: player.entity_id,
                      group_members: [other.entity_id],
                    })
                  }
                />
              ))}
          </MenuBarExtra.Submenu>
          {player.groupMembers.length > 1 && (
            <MenuBarExtra.Submenu title="Ungroup Speakers" icon={Icon.Minus}>
              <MenuBarExtra.Item
                title="Ungroup All"
                icon={Icon.MinusCircle}
                onAction={() => {
                  player.groupMembers.forEach((m: any) => {
                    if (m.entity_id !== player.entity_id) {
                      callService("media_player", "unjoin", {
                        entity_id: m.entity_id,
                      });
                    }
                  });
                }}
              />
              {player.groupMembers.map((m: any) => (
                <MenuBarExtra.Item
                  key={m.entity_id}
                  title={`Remove ${m.attributes?.friendly_name}`}
                  onAction={() =>
                    callService("media_player", "unjoin", {
                      entity_id: m.entity_id,
                    })
                  }
                />
              ))}
            </MenuBarExtra.Submenu>
          )}
        </MenuBarExtra.Section>

        <MenuBarExtra.Section>
          {isRoot ? (
            <MenuBarExtra.Item
              title="Unpin Speaker from Menu Bar"
              icon={Icon.PinDisabled}
              onAction={handleUnpinSpeaker}
            />
          ) : (
            <MenuBarExtra.Item
              title="Pin Speaker to Menu Bar"
              icon={Icon.Pin}
              onAction={() => handlePinSpeaker(player.entity_id)}
            />
          )}
        </MenuBarExtra.Section>
      </>
    );

    if (isRoot) return content;

    return (
      <MenuBarExtra.Submenu
        key={player.entity_id}
        title={title}
        icon={stateIcon}
      >
        {content}
      </MenuBarExtra.Submenu>
    );
  };

  if (error) {
    return (
      <MenuBarExtra icon={Icon.Warning} title="Sonos Error">
        <MenuBarExtra.Item title="Connection Error" subtitle={error} />
        <MenuBarExtra.Item
          title="Open Preferences..."
          onAction={openCommandPreferences}
        />
      </MenuBarExtra>
    );
  }

  try {
  return (
    <MenuBarExtra icon={Icon.Music} isLoading={isLoading}>
      {allPlayers.length === 0 && !isLoading && (
        <MenuBarExtra.Item title="No Sonos players found" />
      )}

      {defaultPlayer && (
        <MenuBarExtra.Section>
          {renderPlayerControls(defaultPlayer, true)}
        </MenuBarExtra.Section>
      )}

      {otherPlayers.length > 0 && (
        <MenuBarExtra.Section
          title={defaultPlayer ? "Other Speakers" : "Speakers"}
        >
          {otherPlayers.map((p) => renderPlayerControls(p, false))}
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title={`Companion App: ${companionActive ? "Connected" : "Disconnected"}`}
          icon={companionActive ? Icon.CheckCircle : Icon.XMarkCircle}
        />
        <MenuBarExtra.Item
          title="Preferences..."
          onAction={openCommandPreferences}
          shortcut={{ modifiers: ["cmd"], key: "," }}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
  } catch(err: any) { return <MenuBarExtra title={`CRASH: ${err.message}`} /> }
}
