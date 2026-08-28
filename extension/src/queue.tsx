import { List, ActionPanel, Action, Icon, openCommandPreferences, Cache } from "@raycast/api";
import { useEffect, useState } from "react";
import { getHAConnection, callService, fetchQueue, getFullImageUrl, filterSonosPlayers, getGroupedPlayers } from "./api";
import { HassEntities, subscribeEntities } from "home-assistant-js-websocket";

const cache = new Cache();

interface QueueItem {
  media_artist: string;
  media_title: string;
  media_content_id: string;
  media_content_type: string;
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
  
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(!cache.has("entities"));
  const [error, setError] = useState<string>();
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>("");

  useEffect(() => {
    let unsubscribe: () => void;
    
    getHAConnection().then((connection) => {
      unsubscribe = subscribeEntities(connection, (newEntities) => {
        setEntities(newEntities);
        cache.set("entities", JSON.stringify(newEntities));
        setIsLoading(false);
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
    fetchQueue(selectedSpeaker)
      .then((data: any) => {
        if (data.response && data.response[selectedSpeaker]) {
          setQueue(data.response[selectedSpeaker]);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch queue", err);
        setQueue([]);
        setIsLoading(false);
      });
  }, [selectedSpeaker, entities[selectedSpeaker]?.attributes?.media_title]);

  if (error) {
    return (
      <List>
        <List.EmptyView title="Error" description={error} actions={
          <ActionPanel>
            <Action title="Open Preferences" onAction={openCommandPreferences} />
          </ActionPanel>
        } />
      </List>
    );
  }

  const activePlayer = sonosPlayers.find((p) => p.entity_id === selectedSpeaker);

  const handlePlayQueueItem = async (queuePosition: number) => {
    await callService("sonos", "play_queue", {
      entity_id: selectedSpeaker,
      queue_position: queuePosition
    });
  };

  const currentQueuePos = activePlayer?.attributes?.queue_position || 1;

  return (
    <List 
      isLoading={isLoading} 
      searchBarPlaceholder="Search Queue..."
      isShowingDetail={true}
      searchBarAccessory={
        sonosPlayers.length > 0 ? (
          <List.Dropdown tooltip="Select Speaker" value={selectedSpeaker} onChange={setSelectedSpeaker}>
            <List.Dropdown.Section title="Sonos Speakers">
              {sonosPlayers.map((player) => (
                <List.Dropdown.Item 
                  key={player.entity_id} 
                  title={player.groupName} 
                  value={player.entity_id} 
                />
              ))}
            </List.Dropdown.Section>
          </List.Dropdown>
        ) : null
      }
    >
      {queue.length === 0 && !isLoading ? (
        <List.EmptyView title="Queue Empty" description="There are no items in the current playback queue." />
      ) : (
        queue.map((item, index) => {
          const isCurrent = (index + 1) === currentQueuePos;
          const displayTitle = item.media_title || "Unknown Title";
          const displaySubtitle = item.media_artist || "";
          
          return (
            <List.Item
              key={`${item.media_content_id}-${index}`}
              title={isCurrent ? `▶ ${displayTitle}` : `${index + 1}. ${displayTitle}`}
              subtitle={displaySubtitle}
              icon={isCurrent ? Icon.Play : Icon.Music}
              detail={
                isCurrent ? (
                  <List.Item.Detail
                    markdown={`<img src="${activePlayer?.attributes?.entity_picture ? getFullImageUrl(activePlayer.attributes.entity_picture) : ""}" height="200" />`}
                    metadata={
                      <List.Item.Detail.Metadata>
                        <List.Item.Detail.Metadata.Label title="State" text={activePlayer?.state || ""} />
                        <List.Item.Detail.Metadata.Label title="Title" text={activePlayer?.attributes?.media_title || "-"} />
                        <List.Item.Detail.Metadata.Label title="Artist" text={activePlayer?.attributes?.media_artist || "-"} />
                        <List.Item.Detail.Metadata.Label title="Album" text={activePlayer?.attributes?.media_album_name || "-"} />
                        <List.Item.Detail.Metadata.Separator />
                        <List.Item.Detail.Metadata.Label title="Volume" text={`${Math.round((activePlayer?.attributes?.volume_level || 0) * 100)}%`} />
                      </List.Item.Detail.Metadata>
                    }
                  />
                ) : (
                  <List.Item.Detail 
                    markdown="*(Track metadata not fully loaded for inactive queue items)*"
                    metadata={
                       <List.Item.Detail.Metadata>
                        <List.Item.Detail.Metadata.Label title="Title" text={displayTitle} />
                        <List.Item.Detail.Metadata.Label title="Artist" text={displaySubtitle} />
                      </List.Item.Detail.Metadata>
                    }
                  />
                )
              }
              actions={
                <ActionPanel>
                  <Action 
                    title="Play Track" 
                    icon={Icon.Play}
                    onAction={() => handlePlayQueueItem(index)} 
                  />
                  <Action 
                    title={activePlayer?.state === "playing" ? "Pause" : "Play"} 
                    icon={activePlayer?.state === "playing" ? Icon.Pause : Icon.Play}
                    onAction={() => callService("media_player", "media_play_pause", { entity_id: selectedSpeaker })} 
                  />
                  <Action 
                    title="Remove from Queue" 
                    icon={Icon.Trash}
                    shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                    onAction={() => callService("sonos", "remove_from_queue", { entity_id: selectedSpeaker, queue_position: index })} 
                  />
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
