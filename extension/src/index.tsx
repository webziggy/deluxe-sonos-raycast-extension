import { MenuBarExtra, openCommandPreferences, Icon, Cache, getPreferenceValues, showHUD } from "@raycast/api";
import { useEffect, useState, useRef } from "react";
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

  const [isFlashVisible, setIsFlashVisible] = useState(false);

  // Trigger the 12-second flash explicitly when the PRIMARY track ACTUALLY changes
  useEffect(() => {
    if (!currentTrack) {
      debugLog("No current track, hiding flash");
      setIsFlashVisible(false);
      cache.remove("lastPrimaryTrack");
      return;
    }
    
    const lastSeen = cache.get("lastPrimaryTrack");
    if (lastSeen === currentTrack) {
      // The component was just remounted by Raycast, but the track didn't actually change.
      return;
    }
    
    cache.set("lastPrimaryTrack", currentTrack);
    
    debugLog("Track changed, showing flash for 12 seconds:", currentTrack);
    setIsFlashVisible(true);
    
    const timer = setTimeout(() => {
      debugLog("12-second timer fired, hiding flash for:", currentTrack);
      setIsFlashVisible(false);
    }, 12000);
    
    return () => {
      debugLog("Clearing 12-second timer for:", currentTrack);
      clearTimeout(timer);
    };
  }, [currentTrack]);

  // Compute the menu title dynamically
  let menuTitle = "Sonos";
  if (currentTrack) {
    const isFlashing = prefs.flashTrackName !== false && isFlashVisible;
    
    if (pinTrackName || isFlashing) {
      const displayLength = 15;
      if (currentTrack.length <= displayLength) {
        menuTitle = `▶ ${currentTrack}`;
      } else {
        menuTitle = `▶ ${currentTrack.substring(0, displayLength)}...`;
      }
    }
  }

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

  const togglePinTrackName = () => {
    const newVal = !pinTrackName;
    cache.set("pinTrackName", newVal ? "true" : "false");
    setPinTrackName(newVal);
  };

  const toggleHUDAlert = () => {
    const newVal = !showHUDAlert;
    cache.set("showHUDAlert", newVal ? "true" : "false");
    setShowHUDAlert(newVal);
  };

  const renderPlayerControls = (player: any, isRoot = false) => {
    const title = player.groupName;
    const state = player.state;
    const mediaTitle = player.attributes?.media_title;
    const mediaArtist = player.attributes?.media_artist;
    const sourceList: string[] = player.attributes?.source_list || [];
    
    const avgVolume = player.groupMembers.reduce((sum: number, m: any) => sum + (m.attributes?.volume_level || 0), 0) / player.groupMembers.length;
    
    const maxLen = 60;
    let fullNowPlaying = "Idle";
    let nowPlaying = "Idle";
    
    if (state === "playing" || state === "paused") {
      fullNowPlaying = [mediaTitle, mediaArtist].filter(Boolean).join(" - ") || "Unknown Media";
      nowPlaying = fullNowPlaying.length > maxLen ? fullNowPlaying.substring(0, maxLen - 3) + "..." : fullNowPlaying;
    } else if (state === "unavailable" || state === "unknown") {
      fullNowPlaying = "Offline";
      nowPlaying = "Offline";
    }

    const stateIcon = state === "playing" 
      ? Icon.Play 
      : state === "paused" 
        ? Icon.Pause 
        : state === "unavailable" || state === "unknown"
          ? Icon.WifiDisabled
          : Icon.Stop;

    const content = (
      <>
        {isRoot && <MenuBarExtra.Item title={title} icon={Icon.Speaker} />}
        <MenuBarExtra.Item title={nowPlaying} tooltip={fullNowPlaying} icon={isRoot ? stateIcon : undefined} />
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
    <MenuBarExtra icon={Icon.Music} isLoading={isLoading} title={menuTitle}>
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
              const displayTitle = item.track.length > 60 ? item.track.substring(0, 57) + "..." : item.track;
              return (
                <MenuBarExtra.Item 
                  key={i} 
                  title={displayTitle} 
                  tooltip={item.track}
                  subtitle={new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 
                />
              );
            })}
          </MenuBarExtra.Submenu>
        </MenuBarExtra.Section>
      )}
      
      <MenuBarExtra.Section>
        <MenuBarExtra.Item 
          title={pinTrackName ? "Unpin Track Name" : "Pin Track Name to Menu Bar"} 
          icon={pinTrackName ? Icon.Text : Icon.Text}
          onAction={togglePinTrackName} 
        />
        <MenuBarExtra.Item 
          title={showHUDAlert ? "Disable HUD Popups" : "Enable HUD Popups"} 
          icon={showHUDAlert ? Icon.EyeDisabled : Icon.Eye}
          onAction={toggleHUDAlert} 
        />
        <MenuBarExtra.Item title="Preferences..." onAction={openCommandPreferences} shortcut={{ modifiers: ["cmd"], key: "," }} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
