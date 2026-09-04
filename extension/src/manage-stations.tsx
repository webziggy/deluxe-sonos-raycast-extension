import {
  List,
  ActionPanel,
  Action,
  Icon,
  Form,
  useNavigation,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  getObservedStations,
  getStationConfig,
  saveStationConfig,
} from "./companionClient";
import { useSonosPlayers } from "./useSonosPlayers";
import { fetchFavourites, getFullImageUrl } from "./api";

export default function Command() {
  const [stations, setStations] = useState<
    Record<string, { title: string; artist: string }>
  >({});
  const [config, setConfig] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [obs, conf] = await Promise.all([
        getObservedStations(),
        getStationConfig(),
      ]);

      const mergedStations: Record<string, { title: string; artist: string }> =
        { ...obs };

      // Add any configured stations that haven't been observed yet
      for (const channelName of Object.keys(conf)) {
        if (!mergedStations[channelName]) {
          mergedStations[channelName] = {
            title: "Historical",
            artist: "Saved Configuration",
          };
        }
      }

      setStations(mergedStations);
      setConfig(conf);
      setIsLoading(false);
    }
    load();
  }, []);

  const refreshConfig = async () => {
    const conf = await getStationConfig();
    setConfig(conf);
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search radio stations...">
      {Object.entries(stations).map(([channelName, sample]) => {
        const conf = config[channelName];
        const hasConfig = conf !== undefined;
        const isSkipped = conf?.skipItunes === true;
        const hasCustomBadge = !!conf?.badgeUrl;

        const accessories: any[] = [];

        if (hasConfig) {
          accessories.push({
            icon: Icon.CheckCircle,
            tooltip: "Custom Settings Applied",
          });
        } else {
          accessories.push({
            icon: Icon.Circle,
            tooltip: "No Custom Settings",
          });
        }

        if (isSkipped) {
          accessories.push({
            icon: Icon.XmarkCircle,
            tooltip: "iTunes API Bypassed",
          });
        }

        return (
          <List.Item
            key={channelName}
            title={channelName}
            subtitle={
              sample.title === "Historical"
                ? "Saved Configuration"
                : `Example: ${sample.title} - ${sample.artist}`
            }
            icon={
              hasCustomBadge
                ? { source: conf.badgeUrl?.replace(/^http:\/\//i, "https://") }
                : Icon.Signal3
            }
            accessories={accessories}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Configure Station"
                  icon={Icon.Gear}
                  target={
                    <ConfigureStation
                      channelName={channelName}
                      currentConfig={conf || {}}
                      onSaved={refreshConfig}
                    />
                  }
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

function ConfigureStation({
  channelName,
  currentConfig,
  onSaved,
}: {
  channelName: string;
  currentConfig: any;
  onSaved: () => void;
}) {
  const { pop } = useNavigation();
  const { players } = useSonosPlayers();
  const [favourites, setFavourites] = useState<
    { title: string; items: any[] }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const [skipItunes, setSkipItunes] = useState(
    currentConfig.skipItunes === true,
  );
  const [badgeUrl, setBadgeUrl] = useState(currentConfig.badgeUrl || "");
  const [favouriteMatch, setFavouriteMatch] = useState(
    currentConfig.linkedFavourite || "_none_",
  );

  useEffect(() => {
    async function fetchFavs() {
      if (players.length > 0) {
        try {
          const res = (await fetchFavourites(players[0].entity_id)) as any;
          let rootItems: any[] = [];
          if (res?.children) rootItems = res.children;
          else if (res?.response?.children) rootItems = res.response.children;
          else if (res?.result?.children) rootItems = res.result.children;

          const folders = rootItems.filter((i) => i.can_expand);
          const nonFolders = rootItems.filter((i) => !i.can_expand);
          const newSections = [];

          if (nonFolders.length > 0) {
            newSections.push({ title: "Favourites", items: nonFolders });
          }

          if (folders.length > 0) {
            try {
              const nestedPromises = folders.map((f) =>
                fetchFavourites(
                  players[0].entity_id,
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
        } catch (e) {
          console.error(e);
        }
      }
      setIsLoading(false);
    }
    fetchFavs();
  }, [players]);

  async function handleSubmit() {
    try {
      const allConfig = await getStationConfig();
      allConfig[channelName] = {
        skipItunes,
        badgeUrl: badgeUrl.trim() === "" ? null : badgeUrl.trim(),
        linkedFavourite: favouriteMatch === "_none_" ? null : favouriteMatch,
      };
      await saveStationConfig(allConfig);
      await showToast({
        style: Toast.Style.Success,
        title: "Configuration Saved",
      });
      onSaved();
      pop();
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to save" });
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Configuration"
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.Description text={`Configuring: ${channelName}`} />

      <Form.Checkbox
        id="skipItunes"
        label="Bypass iTunes Fetcher"
        title="Settings"
        value={skipItunes}
        onChange={setSkipItunes}
        info="Enable this if the station natively provides high-resolution album art."
      />

      <Form.Separator />

      <Form.Dropdown
        id="favouriteMatch"
        title="Link to Sonos Favourite"
        info="Pick a favourite to instantly copy its native Sonos thumbnail URL into the Custom Badge URL field."
        value={favouriteMatch}
        onChange={(val) => {
          setFavouriteMatch(val);
          if (val && val !== "_none_") {
            // Find the item inside the nested sections
            let foundFav: any = null;
            for (const section of favourites) {
              foundFav = section.items.find((f) => f.title === val);
              if (foundFav) break;
            }
            if (foundFav && foundFav.thumbnail) {
              setBadgeUrl(getFullImageUrl(foundFav.thumbnail));
            }
          }
        }}
      >
        <Form.Dropdown.Item value="_none_" title="-- Select a Favourite --" />
        {favourites.map((section) => (
          <Form.Dropdown.Section key={section.title} title={section.title}>
            {section.items.map((fav) => (
              <Form.Dropdown.Item
                key={fav.title}
                value={fav.title}
                title={fav.title}
                icon={
                  fav.thumbnail ? getFullImageUrl(fav.thumbnail) : Icon.Image
                }
              />
            ))}
          </Form.Dropdown.Section>
        ))}
      </Form.Dropdown>

      <Form.TextField
        id="badgeUrl"
        title="Custom Badge URL"
        placeholder="https://..."
        value={badgeUrl}
        onChange={setBadgeUrl}
        info="The image URL to use as the small badge overlay on the desktop notification."
      />
    </Form>
  );
}
