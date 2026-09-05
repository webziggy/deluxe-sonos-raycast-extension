import { useCachedState } from "@raycast/utils";
import {
  Grid,
  ActionPanel,
  Action,
  Icon,
  openCommandPreferences,
  Cache,
  LaunchProps,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { callService, getFullImageUrl, fetchFavourites } from "./api";
import { useSonosPlayers } from "./useSonosPlayers";
import { getSpelling } from "./locale";

const cache = new Cache();

export default function Command(
  props: LaunchProps<{ launchContext?: { entityId?: string } }>,
) {
  const { players: sonosPlayers, isLoading, error } = useSonosPlayers();

  const [selectedSpeaker, setSelectedSpeaker] = useState<string>(
    props.launchContext?.entityId || "",
  );
  const [favourites, setFavourites] = useCachedState<
    { title: string; items: any[] }[]
  >("favourites", []);
  const [favsLoading, setFavsLoading] = useState(false);

  useEffect(() => {
    if (!selectedSpeaker && sonosPlayers.length > 0) {
      const pinned = cache.get("pinnedSpeaker");
      setSelectedSpeaker(
        pinned && sonosPlayers.find((p) => p.entity_id === pinned)
          ? pinned
          : sonosPlayers[0].entity_id,
      );
    }
  }, [sonosPlayers, selectedSpeaker]);

  useEffect(() => {
    if (selectedSpeaker) {
      setFavsLoading(true);
      fetchFavourites(selectedSpeaker)
        .then(async (res: any) => {
          let rootItems: any[] = [];
          if (res?.children) rootItems = res.children;
          else if (res?.response?.children) rootItems = res.response.children;
          else if (res?.result?.children) rootItems = res.result.children;

          const folders = rootItems.filter((i) => i.can_expand);
          const nonFolders = rootItems.filter((i) => !i.can_expand);
          const newSections = [];

          if (nonFolders.length > 0) {
            newSections.push({
              title: getSpelling("Favourites"),
              items: nonFolders,
            });
          }

          if (folders.length > 0) {
            try {
              const nestedPromises = folders.map((f) =>
                fetchFavourites(
                  selectedSpeaker,
                  f.media_content_type,
                  f.media_content_id,
                ),
              );
              const results = await Promise.all(nestedPromises);

              results.forEach((r: any, index: number) => {
                const folderTitle = folders[index].title;
                let children = [];
                if (r?.children) children = r.children;
                else if (r?.response?.children) children = r.response.children;
                else if (r?.result?.children) children = r.result.children;

                if (children.length > 0) {
                  newSections.push({ title: folderTitle, items: children });
                }
              });
            } catch (e) {
              console.error("Failed to fetch nested folders", e);
            }
          }

          setFavourites(newSections);
          
          setFavsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch favourites", err);
          setFavsLoading(false);
        });
    }
  }, [selectedSpeaker]);

  if (error) {
    return (
      <Grid>
        <Grid.EmptyView
          title="Connection Error"
          description={error}
          icon={Icon.Warning}
        />
      </Grid>
    );
  }

  const selectedPlayerData = sonosPlayers.find(
    (p) => p.entity_id === selectedSpeaker,
  );
  const currentSource = selectedPlayerData?.attributes?.source;

  const handlePlayFavourite = async (sourceTitle: string) => {
    if (!selectedSpeaker) return;
    // For Sonos, select_source using the title works perfectly!
    await callService("media_player", "select_source", {
      entity_id: selectedSpeaker,
      source: sourceTitle,
    });
  };

  return (
    <Grid
      isLoading={isLoading || favsLoading}
      columns={4}
      searchBarAccessory={
        sonosPlayers.length > 0 ? (
          <Grid.Dropdown
            tooltip="Select Speaker"
            value={selectedSpeaker}
            onChange={setSelectedSpeaker}
          >
            {sonosPlayers.map((p) => {
              const isOffline =
                p.state === "unavailable" || p.state === "unknown";
              return (
                <Grid.Dropdown.Item
                  key={p.entity_id}
                  title={`${p.groupName}${isOffline ? " (Offline)" : ""}`}
                  value={p.entity_id}
                />
              );
            })}
          </Grid.Dropdown>
        ) : null
      }
    >
      {(Array.isArray(favourites) ? favourites : []).length === 0 && !isLoading && !favsLoading && (
        <Grid.EmptyView
          title={`No ${getSpelling("Favourites")} Found`}
          description={`Add Sonos ${getSpelling("favourites")} in the Sonos app or Home Assistant.`}
          icon={Icon.StarDisabled}
        />
      )}

      {favourites.map((section: any) => (
        <Grid.Section key={section.title} title={section.title}>
          {(Array.isArray(section.items) ? section.items : []).map((fav: any, index: number) => {
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
                    <Action
                      title={`Play ${getSpelling("Favourite")}`}
                      icon={Icon.Play}
                      onAction={() => handlePlayFavourite(fav.title)}
                    />
                    <Action
                      title="Open Preferences"
                      icon={Icon.Gear}
                      onAction={openCommandPreferences}
                      shortcut={{ modifiers: ["cmd"], key: "," }}
                    />
                  </ActionPanel>
                }
              />
            );
          })}
        </Grid.Section>
      ))}
    </Grid>
  );
}
