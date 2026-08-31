import { MenuBarExtra, openCommandPreferences, Icon, Cache, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { getHAConnection, callService, filterSonosPlayers, sortPlayers, Preferences, getGroupedPlayers } from "./api";
import { HassEntities, subscribeEntities } from "home-assistant-js-websocket";

const cache = new Cache();

export default function Command() {
  const prefs = getPreferenceValues<Preferences>();
  
  const [pinnedSpeaker, setPinnedSpeaker] = useState<string | undefined>(cache.get("pinnedSpeaker"));
  const [pinTrackName, setPinTrackName] = useState<boolean>(cache.get("pinTrackName") === "true");
  
  const [entities, setEntities] = useState<HassEntities>(() => {
    const cached = cache.get("entities");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return {};
      }
    }
    return {};
  });
  
  const [isLoading, setIsLoading] = useState(!cache.has("entities"));
  const [error, setError] = useState<string>();

  // Use absolute time to avoid macOS App Nap freezing our timers
  const [now, setNow] = useState(Date.now());
  const [trackStartTime, setTrackStartTime] = useState(Date.now());

  useEffect(() => {
    let unsubscribe: () => void;
    
    getHAConnection().then((connection) => {
      unsubscribe = subscribeEntities(connection, (newEntities) => {
        setEntities(newEntities);
        cache.set("entities", JSON.stringify(newEntities));
        setIsLoading(false);
      });
    }).catch((err) => {
      console.error(err);
      setError(String(err));
      setIsLoading(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  if (error) {
    return (
      <MenuBarExtra icon={Icon.Warning} title="Sonos Error">
        <MenuBarExtra.Item title="Connection Error" subtitle={error} />
        <MenuBarExtra.Item title="Open Preferences..." onAction={openCommandPreferences} />
      </MenuBarExtra>
    );
  }

  const rawPlayers = filterSonosPlayers(entities);
  const allPlayers = getGroupedPlayers(rawPlayers);
  
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

  // Reset track start time when track changes so the marquee and flash timer reset
  useEffect(() => {
    setTrackStartTime(Date.now());
  }, [currentTrack]);

  // Tick every 1 second to update the marquee offset and flash timer
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute the menu title dynamically based on time (immune to freezing)
  let menuTitle = "Sonos";
  if (currentTrack) {
    const flashDurationMs = 12000; // 12 seconds so it has time to scroll a bit
    const isFlashing = prefs.flashTrackName !== false && (now - trackStartTime < flashDurationMs);
    
    if (pinTrackName || isFlashing) {
      const displayLength = 15; // Max characters to take up less width
      if (currentTrack.length <= displayLength) {
        menuTitle = `▶ ${currentTrack}`;
      } else {
        // HiFi Marquee logic
        const paddedTrack = `${currentTrack}   ***   `;
        // Shift by 1 character every second
        const offset = Math.floor((now - trackStartTime) / 1000) % paddedTrack.length;
        const visibleText = (paddedTrack + paddedTrack).substring(offset, offset + displayLength);
        menuTitle = `▶ ${visibleText}`;
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

  const renderPlayerControls = (player: any, isRoot = false) => {
    const title = player.groupName;
    const state = player.state;
    const mediaTitle = player.attributes?.media_title;
    const mediaArtist = player.attributes?.media_artist;
    const sourceList: string[] = player.attributes?.source_list || [];
    
    const avgVolume = player.groupMembers.reduce((sum: number, m: any) => sum + (m.attributes?.volume_level || 0), 0) / player.groupMembers.length;
    
    let nowPlaying = "Idle";
    if (state === "playing" || state === "paused") {
      nowPlaying = [mediaTitle, mediaArtist].filter(Boolean).join(" - ") || "Unknown Media";
    }

    const stateIcon = state === "playing" ? Icon.Play : state === "paused" ? Icon.Pause : Icon.Stop;

    const content = (
      <>
        {isRoot && <MenuBarExtra.Item title={title} icon={Icon.Speaker} />}
        <MenuBarExtra.Item title={nowPlaying} icon={isRoot ? stateIcon : undefined} />
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
    <MenuBarExtra icon="🎵" isLoading={isLoading} title={menuTitle}>
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
      
      <MenuBarExtra.Section>
        <MenuBarExtra.Item 
          title={pinTrackName ? "Unpin Track Name" : "Pin Track Name to Menu Bar"} 
          icon={pinTrackName ? Icon.Text : Icon.Text}
          onAction={togglePinTrackName} 
        />
        <MenuBarExtra.Item title="Preferences..." onAction={openCommandPreferences} shortcut={{ modifiers: ["cmd"], key: "," }} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
