import { List, ActionPanel, Action, Icon, openCommandPreferences, Cache, LaunchProps } from "@raycast/api";
import { useEffect, useState } from "react";
import { callService, fetchQueue, getFullImageUrl } from "./api";
import { useSonosPlayers } from "./useSonosPlayers";

const cache = new Cache();

interface QueueItem {
  media_title: string;
  media_artist: string;
  media_album_name: string;
  entity_picture: string;
}

export default function Command(props: LaunchProps<{ launchContext?: { entityId?: string } }>) {
  const { players: sonosPlayers, isLoading: playersLoading, error } = useSonosPlayers();
  
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>(props.launchContext?.entityId || "");

  useEffect(() => {
    if (!selectedSpeaker && sonosPlayers.length > 0) {
      const pinned = cache.get("pinnedSpeaker"); 
      setSelectedSpeaker(pinned && sonosPlayers.find(p => p.entity_id === pinned) ? pinned : sonosPlayers[0].entity_id);
    }
  }, [sonosPlayers, selectedSpeaker]);

  useEffect(() => {
    if (selectedSpeaker) {
      setQueueLoading(true);
      fetchQueue(selectedSpeaker)
        .then((res: any) => {
          console.log("QUEUE RESPONSE:", JSON.stringify(res));
          let items: any[] = [];
          if (Array.isArray(res)) {
            items = res;
          } else if (res?.response) {
            items = res.response[selectedSpeaker] || Object.values(res.response)[0] || [];
          } else if (res && typeof res === 'object') {
            items = res[selectedSpeaker] || Object.values(res)[0] || [];
          }
          setQueue(Array.isArray(items) ? items : []);
          setQueueLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch queue", err);
          setQueueLoading(false);
        });
    }
  }, [selectedSpeaker]);

  if (error) {
    return <List><List.EmptyView title="Connection Error" description={error} icon={Icon.Warning} /></List>;
  }

  const handlePlayQueueItem = async (index: number) => {
    if (!selectedSpeaker) return;
    await callService("sonos", "play_queue", { entity_id: selectedSpeaker, queue_position: index });
  };

  const handleRemoveQueueItem = async (index: number) => {
    if (!selectedSpeaker) return;
    await callService("sonos", "remove_from_queue", { entity_id: selectedSpeaker, queue_position: index });
    setQueue(q => q.filter((_, i) => i !== index));
  };

  return (
    <List 
      isLoading={playersLoading || queueLoading} 
      searchBarAccessory={
        sonosPlayers.length > 0 ? (
          <List.Dropdown tooltip="Select Speaker" value={selectedSpeaker} onChange={setSelectedSpeaker}>
            {sonosPlayers.map(p => {
              const isOffline = p.state === "unavailable" || p.state === "unknown";
              return (
                <List.Dropdown.Item 
                  key={p.entity_id} 
                  title={`${p.groupName}${isOffline ? ' (Offline)' : ''}`} 
                  value={p.entity_id} 
                />
              );
            })}
          </List.Dropdown>
        ) : null
      }
    >
      {queue.length === 0 && !queueLoading && (
        <List.EmptyView title="Queue is empty" description="No tracks are currently queued on this speaker." icon={Icon.List} />
      )}
      
      {queue.map((item, index) => (
        <List.Item
          key={`${item.media_title}-${index}`}
          title={item.media_title || "Unknown Track"}
          subtitle={item.media_artist || "Unknown Artist"}
          accessories={[{ text: item.media_album_name }]}
          detail={
            item.entity_picture ? (
              <List.Item.Detail markdown={`<img src="${getFullImageUrl(item.entity_picture)}" height="200" />`} />
            ) : undefined
          }
          actions={
            <ActionPanel>
              <Action title="Play Now" icon={Icon.Play} onAction={() => handlePlayQueueItem(index)} />
              <Action title="Remove from Queue" icon={Icon.Trash} style={Action.Style.Destructive} onAction={() => handleRemoveQueueItem(index)} />
              <Action title="Open Preferences" icon={Icon.Gear} onAction={openCommandPreferences} shortcut={{ modifiers: ["cmd"], key: "," }} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
