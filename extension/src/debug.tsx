import { List, ActionPanel, Action, Icon, showToast, Toast, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { getCompanionHistory, notifyCompanion } from "./companionClient";

export default function Command() {
  const prefs = getPreferenceValues();
  if (!prefs.enableDebugCommands) {
    return (
      <List>
        <List.EmptyView title="Debug Commands Disabled" description="Enable them in the extension preferences." />
      </List>
    );
  }

  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      const hist = await getCompanionHistory();
      setHistory(hist);
      setIsLoading(false);
    }
    fetchHistory();
  }, []);

  async function handleReRaise(item: any) {
    try {
      await notifyCompanion(item);
      await showToast({ style: Toast.Style.Success, title: "Notification Triggered" });
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to trigger" });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search history...">
      {history.length === 0 && !isLoading && (
        <List.EmptyView title="No History Found" description="Play some tracks to populate history." />
      )}
      {history.map((item, index) => (
        <List.Item
          key={index}
          icon={item.badgeUrl ? { source: item.badgeUrl } : (item.artUrl ? { source: item.artUrl } : Icon.Music)}
          title={item.track || "Unknown Track"}
          subtitle={`on ${item.speaker || "Unknown Speaker"}`}
          accessories={[
            { icon: item.badgeUrl ? Icon.StarCircle : undefined, tooltip: item.badgeUrl ? "iTunes API Match" : "" }
          ]}
          actions={
            <ActionPanel>
              <Action title="Re-raise Notification" icon={Icon.AppWindowList} onAction={() => handleReRaise(item)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
