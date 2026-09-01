import { Grid, ActionPanel, Action, Icon, openCommandPreferences, Cache } from "@raycast/api";
import { useEffect, useState } from "react";
import { callService, getFullImageUrl } from "./api";
import { useSonosPlayers } from "./useSonosPlayers";

const cache = new Cache();

export default function Command() {
  const { players: sonosPlayers, isLoading, error } = useSonosPlayers();
  
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");

  useEffect(() => {
    if (!selectedSpeaker && sonosPlayers.length > 0) {
      const pinned = cache.get("pinnedSpeaker"); 
      setSelectedSpeaker(pinned && sonosPlayers.find(p => p.entity_id === pinned) ? pinned : sonosPlayers[0].entity_id);
    }
  }, [sonosPlayers, selectedSpeaker]);

  if (error) {
    return <Grid><Grid.EmptyView title="Connection Error" description={error} icon={Icon.Warning} /></Grid>;
  }

  const selectedPlayerData = sonosPlayers.find(p => p.entity_id === selectedSpeaker);
  const favourites = selectedPlayerData?.attributes?.source_list || [];
  const currentSource = selectedPlayerData?.attributes?.source;

  const handlePlayFavourite = async (source: string) => {
    if (!selectedSpeaker) return;
    await callService("media_player", "select_source", { entity_id: selectedSpeaker, source });
  };

  return (
    <Grid 
      isLoading={isLoading}
      columns={4}
      searchBarAccessory={
        sonosPlayers.length > 0 ? (
          <Grid.Dropdown tooltip="Select Speaker" value={selectedSpeaker} onChange={setSelectedSpeaker}>
            {sonosPlayers.map(p => {
              const isOffline = p.state === "unavailable" || p.state === "unknown";
              return (
                <Grid.Dropdown.Item 
                  key={p.entity_id} 
                  title={`${p.groupName}${isOffline ? ' (Offline)' : ''}`} 
                  value={p.entity_id} 
                />
              );
            })}
          </Grid.Dropdown>
        ) : null
      }
    >
      {favourites.length === 0 && !isLoading && (
        <Grid.EmptyView title="No Favourites Found" description="Add Sonos favourites in the Sonos app or Home Assistant." icon={Icon.StarDisabled} />
      )}
      
      {favourites.map((source: string) => {
        const isPlaying = source === currentSource;
        return (
          <Grid.Item
            key={source}
            title={source}
            subtitle={isPlaying ? "Playing..." : undefined}
            content={Icon.Star}
            actions={
              <ActionPanel>
                <Action title="Play Favourite" icon={Icon.Play} onAction={() => handlePlayFavourite(source)} />
                <Action title="Open Preferences" icon={Icon.Gear} onAction={openCommandPreferences} shortcut={{ modifiers: ["cmd"], key: "," }} />
              </ActionPanel>
            }
          />
        );
      })}
    </Grid>
  );
}
