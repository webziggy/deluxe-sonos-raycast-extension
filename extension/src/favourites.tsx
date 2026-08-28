import { Grid, ActionPanel, Action, Icon, openCommandPreferences, Cache } from "@raycast/api";
import { useEffect, useState } from "react";
import { getHAConnection, fetchFavourites, callService, getFullImageUrl, filterSonosPlayers, getGroupedPlayers } from "./api";
import { HassEntities, subscribeEntities } from "home-assistant-js-websocket";

const cache = new Cache();

interface MediaClass {
  title: string;
  media_content_id: string;
  media_content_type: string;
  media_class: string;
  thumbnail: string;
  children?: MediaClass[];
}

export default function Command() {
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
  
  const [favourites, setFavourites] = useState<MediaClass[]>([]);
  const [isLoading, setIsLoading] = useState(!cache.has("entities"));
  const [error, setError] = useState<string>();
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");

  useEffect(() => {
    let unsubscribe: () => void;
    
    getHAConnection().then((connection) => {
      unsubscribe = subscribeEntities(connection, (newEntities) => {
        setEntities(newEntities);
        cache.set("entities", JSON.stringify(newEntities));
      });
    }).catch((err) => {
      setError(String(err));
      setIsLoading(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const sonosPlayers = getGroupedPlayers(filterSonosPlayers(entities));

  useEffect(() => {
    if (!selectedSpeaker && sonosPlayers.length > 0) {
      const pinned = cache.get("pinnedSpeaker"); setSelectedSpeaker(pinned && sonosPlayers.find(p => p.entity_id === pinned) ? pinned : sonosPlayers[0].entity_id);
    }
  }, [sonosPlayers, selectedSpeaker]);

  useEffect(() => {
    if (!selectedSpeaker) return;
    
    setIsLoading(true);
    fetchFavourites(selectedSpeaker)
      .then((data: any) => {
        if (data && data.children) {
          setFavourites(data.children);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(String(err));
        setIsLoading(false);
      });
  }, [selectedSpeaker]);

  if (error) {
    return (
      <Grid>
        <Grid.EmptyView title="Error" description={error} actions={
          <ActionPanel>
            <Action title="Open Preferences" onAction={openCommandPreferences} />
          </ActionPanel>
        } />
      </Grid>
    );
  }

  const handlePlay = async (mediaId: string, mediaType: string) => {
    await callService("media_player", "play_media", {
      entity_id: selectedSpeaker,
      media_content_id: mediaId,
      media_content_type: mediaType
    });
  };

  return (
    <Grid 
      columns={5} 
      isLoading={isLoading} 
      searchBarPlaceholder="Search Favourites..."
      searchBarAccessory={
        sonosPlayers.length > 0 ? (
          <Grid.Dropdown tooltip="Select Speaker" value={selectedSpeaker} onChange={setSelectedSpeaker}>
            <Grid.Dropdown.Section title="Sonos Speakers">
              {sonosPlayers.map((player) => (
                <Grid.Dropdown.Item 
                  key={player.entity_id} 
                  title={player.groupName} 
                  value={player.entity_id} 
                />
              ))}
            </Grid.Dropdown.Section>
          </Grid.Dropdown>
        ) : null
      }
    >
      <Grid.EmptyView icon={Icon.Star} title="No Favourites Found" description="Could not load Sonos favourites from Home Assistant." />
      {favourites.map((fav) => (
        <Grid.Item
          key={fav.media_content_id}
          title={fav.title}
          content={fav.thumbnail ? getFullImageUrl(fav.thumbnail) : Icon.Music}
          actions={
            <ActionPanel>
              <Action title="Play on Speaker" icon={Icon.Play} onAction={() => handlePlay(fav.media_content_id, fav.media_content_type)} />
            </ActionPanel>
          }
        />
      ))}
    </Grid>
  );
}
