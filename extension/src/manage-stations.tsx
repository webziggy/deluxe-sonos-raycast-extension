import { List, ActionPanel, Action, Icon, Form, useNavigation, showToast, Toast } from "@raycast/api";
import { useEffect, useState } from "react";
import { getObservedStations, getStationConfig, saveStationConfig } from "./companionClient";
import { useSonosPlayers } from "./useSonosPlayers";
import { fetchFavourites, getFullImageUrl } from "./api";

export default function Command() {
  const [stations, setStations] = useState<Record<string, {title: string, artist: string}>>({});
  const [config, setConfig] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [obs, conf] = await Promise.all([
        getObservedStations(),
        getStationConfig()
      ]);
      setStations(obs);
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
        const conf = config[channelName] || {};
        const isSkipped = conf.skipItunes === true;
        const hasCustomBadge = !!conf.badgeUrl;
        
        return (
          <List.Item
            key={channelName}
            title={channelName}
            subtitle={`Example: ${sample.title} - ${sample.artist}`}
            icon={hasCustomBadge ? { source: conf.badgeUrl } : Icon.Signal3}
            accessories={[
              isSkipped ? { icon: Icon.XmarkCircle, tooltip: "iTunes API Bypassed" } : {},
            ]}
            actions={
              <ActionPanel>
                <Action.Push 
                  title="Configure Station" 
                  icon={Icon.Gear}
                  target={
                    <ConfigureStation 
                      channelName={channelName} 
                      currentConfig={conf} 
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
  onSaved 
}: { 
  channelName: string; 
  currentConfig: any;
  onSaved: () => void;
}) {
  const { pop } = useNavigation();
  const { players } = useSonosPlayers();
  const [favourites, setFavourites] = useState<{title: string, thumbnail: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [skipItunes, setSkipItunes] = useState(currentConfig.skipItunes === true);
  const [badgeUrl, setBadgeUrl] = useState(currentConfig.badgeUrl || "");

  useEffect(() => {
    async function fetchFavs() {
      if (players.length > 0) {
        try {
          const res = await fetchFavourites(players[0].entity_id) as any;
          if (res?.children) {
            setFavourites(res.children);
          }
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
        badgeUrl: badgeUrl.trim() === "" ? null : badgeUrl.trim() 
      };
      await saveStationConfig(allConfig);
      await showToast({ style: Toast.Style.Success, title: "Configuration Saved" });
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
          <Action.SubmitForm title="Save Configuration" onSubmit={handleSubmit} />
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
        onChange={(val) => {
          if (val && val !== "_none_") {
            const fav = favourites.find(f => f.title === val);
            if (fav && fav.thumbnail) {
              setBadgeUrl(getFullImageUrl(fav.thumbnail));
            }
          }
        }}
      >
        <Form.Dropdown.Item value="_none_" title="-- Select a Favourite --" />
        {favourites.map(fav => (
          <Form.Dropdown.Item key={fav.title} value={fav.title} title={fav.title} icon={fav.thumbnail ? getFullImageUrl(fav.thumbnail) : Icon.Image} />
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
