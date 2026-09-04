import {
  Form,
  ActionPanel,
  Action,
  LocalStorage,
  showToast,
  Toast,
  Icon,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { syncFiltersToCompanion, saveStationConfig } from "./companionClient";

export default function Command() {
  const [backupJson, setBackupJson] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const a = await LocalStorage.getItem<string>("allowlist");
      const b = await LocalStorage.getItem<string>("blocklist");
      const cStr = await LocalStorage.getItem<string>("stationConfig");

      let configObj = {};
      if (cStr) {
        try {
          configObj = JSON.parse(cStr);
        } catch (e) {}
      }

      const backupObj = {
        allowlist: a || "",
        blocklist: b || "",
        stationConfig: configObj,
      };

      setBackupJson(JSON.stringify(backupObj, null, 2));
      setIsLoading(false);
    }
    load();
  }, []);

  async function handleImport() {
    try {
      const obj = JSON.parse(backupJson);

      const a = obj.allowlist || "";
      const b = obj.blocklist || "";
      const cStr = obj.stationConfig ? JSON.stringify(obj.stationConfig) : "{}";

      if (a) await LocalStorage.setItem("allowlist", a);
      else await LocalStorage.removeItem("allowlist");

      if (b) await LocalStorage.setItem("blocklist", b);
      else await LocalStorage.removeItem("blocklist");

      await LocalStorage.setItem("stationConfig", cStr);

      // Proactively sync immediately to Companion App
      const aList = a
        .split("\n")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      const bList = b
        .split("\n")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      await syncFiltersToCompanion(aList, bList);

      if (obj.stationConfig) {
        await saveStationConfig(obj.stationConfig);
      }

      await showToast({
        style: Toast.Style.Success,
        title: "Configuration Restored & Synced!",
      });
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Invalid JSON Format",
        message: "Please ensure the pasted text is a valid JSON object.",
      });
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Restore from JSON"
            icon={Icon.Download}
            onSubmit={handleImport}
          />
          <Action.CopyToClipboard
            title="Copy Backup to Clipboard"
            content={backupJson}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Backup & Restore"
        text="Copy the JSON payload below to save your configuration, or paste a previously saved JSON payload and hit Restore."
      />
      {!isLoading && (
        <Form.TextArea
          id="backupJson"
          title="Configuration JSON"
          value={backupJson}
          onChange={setBackupJson}
          enableMarkdown={false}
        />
      )}
    </Form>
  );
}
