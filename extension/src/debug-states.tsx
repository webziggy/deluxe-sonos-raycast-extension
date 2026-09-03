import { List, ActionPanel, Action, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch from "node-fetch";
import { getCompanionDebugStates } from "./companionClient";

export default function Command() {
  const [states, setStates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStates() {
      const data = await getCompanionDebugStates();
      setStates(data);
      setIsLoading(false);
    }
    fetchStates();
  }, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search states...">
      {states.map((item, index) => (
        <List.Item
          key={index}
          title={item.entity_id}
          subtitle={item.state}
          accessories={[{ text: "Press Enter to view raw JSON" }]}
          actions={
            <ActionPanel>
              <Action.Push title="View Raw JSON" target={<StateDetail item={item} />} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function StateDetail({ item }: { item: any }) {
  return (
    <List>
      <List.Item
        title="Copy to Clipboard"
        icon={Icon.Clipboard}
        actions={
          <ActionPanel>
            <Action.CopyToClipboard content={JSON.stringify(item, null, 2)} />
          </ActionPanel>
        }
      />
      {Object.entries(item.attributes || {}).map(([key, val]) => (
        <List.Item key={key} title={key} subtitle={String(val)} />
      ))}
    </List>
  );
}
