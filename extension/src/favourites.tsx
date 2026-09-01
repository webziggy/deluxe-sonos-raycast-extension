import { Grid, ActionPanel, Action, Icon, openCommandPreferences, Cache, LaunchProps } from "@raycast/api";
import { useEffect, useState } from "react";
import { callService, getFullImageUrl, fetchFavourites } from "./api";
import { useSonosPlayers } from "./useSonosPlayers";

const cache = new Cache();

export default function Command(props: LaunchProps<{ launchContext?: { entityId?: string } }>) {
  const { players: sonosPlayers, isLoading, error } = useSonosPlayers();
  
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>(props.launchContext?.entityId || "");
  const [favourites, setFavourites] = useState<any[]>([]);
  const [favsLoading, setFavsLoading] = useState(false);

  useEffect(() => {
    if (!selectedSpeaker && sonosPlayers.length > 0) {
      const pinned = cache.get("pinnedSpeaker"); 
      setSelectedSpeaker(pinned && sonosPlayers.find(p => p.entity_id === pinned) ? pinned : sonosPlayers[0].entity_id);
    }
  }, [sonosPlayers, selectedSpeaker]);

  useEffect(() => {
    if (selectedSpeaker) {
      setFavsLoading(true);
      fetchFavourites(selectedSpeaker).then((res: any) => {
        let items: any[] = [];
        if (res?.children) items = res.children;
        else if (res?.response?.children) items = res.response.children;
        else if (res?.result?.children) items = res.result.children; // Sometimes it's wrapped in result
        
        // As a fallback, if browse_media fails, we could use source_list, but let's just stick to the API response
        setFavourites(Array.isArray(items) ? items : []);
        setFavsLoading(false);
      }).catch((err) => {
        console.error("Failed to fetch favourites", err);
        setFavsLoading(false);
      });
    }
  }, [selectedSpeaker]);

  if (error) {
    return <Grid><Grid.EmptyView title="Connection Error" description={error} icon={Icon.Warning} /></Grid>;
  }

  const selectedPlayerData = sonosPlayers.find(p => p.entity_id === selectedSpeaker);
  const currentSource = selectedPlayerData?.attributes?.source;

  const handlePlayFavourite = async (sourceTitle: string) => {
    if (!selectedSpeaker) return;
    // For Sonos, select_source using the title works perfectly!
    await callService("media_player", "select_source", { entity_id: selectedSpeaker, source: sourceTitle });
  };

  return (
    <Grid 
      isLoading={isLoading || favsLoading}
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
      {favourites.length === 0 && !isLoading && !favsLoading && (
        <Grid.EmptyView title="No Favourites Found" description="Add Sonos favourites in the Sonos app or Home Assistant." icon={Icon.StarDisabled} />
      )}
      
      {favourites.map((fav: any, index: number) => {
        const isPlaying = fav.title === currentSource;
        const imageUrl = getFullImageUrl(fav.thumbnail);
        
        return (
          <Grid.Item
            key={`${fav.media_content_id}-${index}`}
            title={fav.title}
            subtitle={isPlaying ? "Playing..." : undefined}
            content={imageUrl ? { source: imageUrl } : Icon.Star}
            actions={
              <ActionPanel>
                <Action title="Play Favourite" icon={Icon.Play} onAction={() => handlePlayFavourite(fav.title)} />
                <Action title="Open Preferences" icon={Icon.Gear} onAction={openCommandPreferences} shortcut={{ modifiers: ["cmd"], key: "," }} />
              </ActionPanel>
            }
          />
        );
      })}
    </Grid>
  );
}
