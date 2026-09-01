import { MenuBarExtra, openCommandPreferences, Icon, Cache, getPreferenceValues, showHUD } from "@raycast/api";
import { useEffect, useState, useRef, Fragment } from "react";
import { callService, Preferences } from "./api";
import { useSonosPlayers } from "./useSonosPlayers";

const cache = new Cache();

export default function Command() {
  const prefs = getPreferenceValues<Preferences>();
  
  const [pinnedSpeaker, setPinnedSpeaker] = useState<string | undefined>(cache.get("pinnedSpeaker"));
  const [pinTrackName, setPinTrackName] = useState<boolean>(cache.get("pinTrackName") === "true");
  const [showHUDAlert, setShowHUDAlert] = useState<boolean>(() => {
    const cached = cache.get("showHUDAlert");
    if (cached !== undefined) return cached === "true";
    return prefs.showHudOnTrackChange === true;
  });

  const debugLog = (...args: any[]) => {
    if (prefs.debugLogging) console.log(new Date().toISOString(), "[DEBUG]", ...args);
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

  const { players: allPlayers, isLoading, error } = useSonosPlayers();

  // Use absolute time to avoid macOS App Nap freezing our timers

  if (error) {
    return (
      <MenuBarExtra icon={Icon.Warning} title="Sonos Error">
        <MenuBarExtra.Item title="Connection Error" subtitle={error} />
        <MenuBarExtra.Item title="Open Preferences..." onAction={openCommandPreferences} />
      </MenuBarExtra>
    );
  }

  const sortedPlayers = [...allPlayers].sort((a, b) => {
    if (a.entity_id === pinnedSpeaker) return -1;
    if (b.entity_id === pinnedSpeaker) return 1;
    return 0;
  });
  
  const defaultPlayer = pinnedSpeaker ? allPlayers.find(p => p.entity_id === pinnedSpeaker) : null;
  const otherPlayers = defaultPlayer ? allPlayers.filter(p => p.entity_id !== defaultPlayer.entity_id) : sortedPlayers;

  const primaryPlayer = defaultPlayer || sortedPlayers[0];
  const currentTrack = primaryPlayer?.state === "playing" 
    ? [primaryPlayer.attributes?.media_title, primaryPlayer.attributes?.media_artist].filter(Boolean).join(" - ")
    : null;

  const [trackHistory, setTrackHistory] = useState<{track: string, timestamp: number}[]>(() => {
    try { return JSON.parse(cache.get("trackHistory") || "[]"); } catch (e) { return []; }
  });

  const lastTracksRef = useRef<Record<string, string>>(
    (() => {
      try { return JSON.parse(cache.get("lastTracks") || "{}"); } catch (e) { return {}; }
    })()
  );

  // Monitor ALL speakers for track changes to trigger HUD and History
  useEffect(() => {
    let triggeredChange = false;

    for (const player of allPlayers) {
      const trackString = player.state === "playing" 
        ? [player.attributes?.media_title, player.attributes?.media_artist].filter(Boolean).join(" - ")
        : "";

      if (trackString && trackString !== lastTracksRef.current[player.entity_id]) {
        // Track changed for this specific player!
        if (showHUDAlert) {
          showHUD(`[${player.groupName}] ▶ ${trackString}`);
        }

        const historyEntry = `[${player.groupName}] ${trackString}`;
        
        setTrackHistory(prev => {
          // Prevent rapid back-to-back duplicates for the same speaker
          if (prev.length > 0 && prev[0].track === historyEntry) {
            return prev;
          }
          const newHistory = [{ track: historyEntry, timestamp: Date.now() }, ...prev];
          const trimmedHistory = newHistory.slice(0, 10);
          cache.set("trackHistory", JSON.stringify(trimmedHistory));
          return trimmedHistory;
        });

        triggeredChange = true;
      }
      lastTracksRef.current[player.entity_id] = trackString;
    }

    if (triggeredChange) {
      cache.set("lastTracks", JSON.stringify(lastTracksRef.current));
    }
  }, [allPlayers, showHUDAlert]);


  const handlePlayPause = async (entityId: string) => {
    await callService("media_player", "media_play_pause", { entity_id: entityId });
  };

  const handleNext = async (entityId: string) => {
    await callService("media_player", "media_next_track", { entity_id: entityId });
  };

  const handlePrevious = async (entityId: string) => {
    await callService("media_player", "media_previous_track", { entity_id: entityId });
  };

  const handleVolumeChange = async (members: any[], change: number) => {
    for (const member of members) {
      const currentVolume = member.attributes?.volume_level || 0;
      const newVolume = Math.max(0, Math.min(1, currentVolume + change));
      await callService("media_player", "volume_set", { entity_id: member.entity_id, volume_level: newVolume });
    }
  };

  const handleSetExactVolume = async (members: any[], volume: number) => {
    for (const member of members) {
      await callService("media_player", "volume_set", { entity_id: member.entity_id, volume_level: volume });
    }
  };

  const handleToggleMute = async (members: any[], isCurrentlyMuted: boolean) => {
    for (const member of members) {
      await callService("media_player", "volume_mute", { entity_id: member.entity_id, is_volume_muted: !isCurrentlyMuted });
    }
  };

  const handleSelectSource = async (entityId: string, source: string) => {
    await callService("media_player", "select_source", { entity_id: entityId, source });
  };

  const handlePinSpeaker = (entityId: string) => {
    cache.set("pinnedSpeaker", entityId);
    setPinnedSpeaker(entityId);
  };

  const handleUnpinSpeaker = () => {
    cache.remove("pinnedSpeaker");
    setPinnedSpeaker(undefined);
  };

  const toggleHUDAlert = () => {
    const newVal = !showHUDAlert;
    cache.set("showHUDAlert", newVal ? "true" : "false");
    setShowHUDAlert(newVal);
  };

  const renderExactVolumeSubmenu = (members: any[], title = "Set Exact Volume") => (
    <MenuBarExtra.Submenu title={title} icon={Icon.Speaker}>
      {Array.from({ length: 10 }, (_, i) => i * 10).map(tens => (
        <MenuBarExtra.Submenu key={tens} title={`${tens}% - ${tens + 9}%`}>
          {Array.from({ length: 10 }, (_, i) => tens + i).map(vol => (
            <MenuBarExtra.Item 
              key={vol} 
              title={`${vol}%`} 
              onAction={() => handleSetExactVolume(members, vol / 100)} 
            />
          ))}
        </MenuBarExtra.Submenu>
      ))}
      <MenuBarExtra.Item title="100%" onAction={() => handleSetExactVolume(members, 1)} />
    </MenuBarExtra.Submenu>
  );

  const renderPlayerControls = (player: any, isRoot = false) => {
    const title = player.groupName;
    const state = player.state;
    const mediaTitle = player.attributes?.media_title;
    const mediaArtist = player.attributes?.media_artist;
    const sourceList: string[] = player.attributes?.source_list || [];
    
    const avgVolume = player.groupMembers.reduce((sum: number, m: any) => sum + (m.attributes?.volume_level || 0), 0) / player.groupMembers.length;
    const isMuted = player.groupMembers.some((m: any) => m.attributes?.is_volume_muted);
    
    const maxLen = 60;
    let fullNowPlaying = "Idle";
    let nowPlayingLines = ["Idle"];
    
    if (state === "playing" || state === "paused") {
      fullNowPlaying = [mediaTitle, mediaArtist].filter(Boolean).join(" - ") || "Unknown Media";
      nowPlayingLines = wrapText(fullNowPlaying, maxLen);
    } else if (state === "unavailable" || state === "unknown") {
      fullNowPlaying = "Offline";
      nowPlayingLines = ["Offline"];
    }

    const stateIcon = state === "playing" 
      ? Icon.Play 
      : state === "paused" 
        ? Icon.Pause 
        : state === "unavailable" || state === "unknown"
          ? Icon.WifiDisabled
          : Icon.Stop;

    const transparentIcon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    const content = (
      <>
        {isRoot && <MenuBarExtra.Item title={title} icon={Icon.Speaker} />}
        {nowPlayingLines.map((line, index) => (
          <MenuBarExtra.Item 
            key={`nowPlaying-${index}`}
            title={line} 
            icon={isRoot ? (index === 0 ? stateIcon : transparentIcon) : undefined} 
          />
        ))}
        {!isRoot && <MenuBarExtra.Item title={`State: ${state}`} />}
        
        <MenuBarExtra.Section title="Controls">
          <MenuBarExtra.Item 
            title={state === "playing" ? "Pause" : "Play"} 
            icon={state === "playing" ? Icon.Pause : Icon.Play}
            shortcut={isRoot ? { modifiers: ["cmd"], key: "p" } : undefined}
            onAction={() => handlePlayPause(player.entity_id)} 
          />
          <MenuBarExtra.Item 
            title="Next Track" 
            icon={Icon.Forward}
            shortcut={isRoot ? { modifiers: ["cmd"], key: "arrowRight" } : undefined}
            onAction={() => handleNext(player.entity_id)} 
          />
          <MenuBarExtra.Item 
            title="Previous Track" 
            icon={Icon.Rewind}
            shortcut={isRoot ? { modifiers: ["cmd"], key: "arrowLeft" } : undefined}
            onAction={() => handlePrevious(player.entity_id)} 
          />
        </MenuBarExtra.Section>

        <MenuBarExtra.Section title={`Group Volume (${Math.round(avgVolume * 100)}%)`}>
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
                  <MenuBarExtra.Submenu key={m.entity_id} title={`${m.attributes?.friendly_name} (${vol}%)`} icon={Icon.Speaker}>
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

        {sourceList.length > 0 && (
          <MenuBarExtra.Section>
            <MenuBarExtra.Submenu title="Favourites" icon={Icon.Star}>
              {sourceList.map((source) => (
                <MenuBarExtra.Item 
                  key={source} 
                  title={source} 
                  onAction={() => handleSelectSource(player.entity_id, source)} 
                />
              ))}
            </MenuBarExtra.Submenu>
          </MenuBarExtra.Section>
        )}
        
        <MenuBarExtra.Section>
          {isRoot ? (
            <MenuBarExtra.Item title="Unpin Speaker from Menu Bar" icon={Icon.PinDisabled} onAction={handleUnpinSpeaker} />
          ) : (
            <MenuBarExtra.Item title="Pin Speaker to Menu Bar" icon={Icon.Pin} onAction={() => handlePinSpeaker(player.entity_id)} />
          )}
        </MenuBarExtra.Section>
      </>
    );

    if (isRoot) return content;
    
    return (
      <MenuBarExtra.Submenu key={player.entity_id} title={title} icon={stateIcon}>
        {content}
      </MenuBarExtra.Submenu>
    );
  };

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
        <MenuBarExtra.Section title={defaultPlayer ? "Other Speakers" : "Speakers"}>
          {otherPlayers.map(p => renderPlayerControls(p, false))}
        </MenuBarExtra.Section>
      )}
      
      {trackHistory.length > 0 && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Submenu title="Recently Played" icon={Icon.Clock}>
            {trackHistory.map((item, i) => {
              const displayLines = wrapText(item.track, 60);
              return (
                <Fragment key={i}>
                  {displayLines.map((line, lineIdx) => (
                    <MenuBarExtra.Item 
                      key={`${i}-${lineIdx}`}
                      title={line} 
                      subtitle={lineIdx === 0 ? new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : undefined} 
                    />
                  ))}
                </Fragment>
              );
            })}
          </MenuBarExtra.Submenu>
        </MenuBarExtra.Section>
      )}
      
      <MenuBarExtra.Section>
        <MenuBarExtra.Item 
          title={showHUDAlert ? "Disable Toast Notifications" : "Enable Toast Notifications"} 
          icon={showHUDAlert ? Icon.EyeDisabled : Icon.Eye}
          onAction={toggleHUDAlert} 
        />
        <MenuBarExtra.Item title="Preferences..." onAction={openCommandPreferences} shortcut={{ modifiers: ["cmd"], key: "," }} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
