import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  LocalStorage,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { getCompanionHistory, syncFiltersToCompanion } from "./companionClient";

export default function FiltersCommand() {
  const [initialAllowlist, setInitialAllowlist] = useState<string>("");
  const [initialBlocklist, setInitialBlocklist] = useState<string>("");
  const [history, setHistory] = useState<string>("Loading...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const a = await LocalStorage.getItem<string>("allowlist");
      const b = await LocalStorage.getItem<string>("blocklist");
      if (a) setInitialAllowlist(a);
      if (b) setInitialBlocklist(b);

      const hist = await getCompanionHistory();
      if (hist.length > 0) {
        setHistory(
          hist.map((h: any) => `• ${h.track} on ${h.speaker}`).join("\n"),
        );
      } else {
        setHistory("No recent tracks recorded yet.");
      }
      setIsLoading(false);
    }
    load();
  }, []);

  async function submit(values: { allowlist?: string; blocklist?: string }) {
    const aStr = values.allowlist ?? "";
    const bStr = values.blocklist ?? "";

    const aList = aStr
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const bList = bStr
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Validate Regex Patterns
    for (const p of [...aList, ...bList]) {
      try {
        new RegExp(p);
      } catch (e: any) {
        showToast({
          title: "Invalid Regex Pattern",
          message: e.message || p,
          style: Toast.Style.Failure,
        });
        return; // Halt saving
      }
    }

    if (aStr) {
      await LocalStorage.setItem("allowlist", aStr);
    } else {
      await LocalStorage.removeItem("allowlist");
    }

    if (bStr) {
      await LocalStorage.setItem("blocklist", bStr);
    } else {
      await LocalStorage.removeItem("blocklist");
    }

    await syncFiltersToCompanion(aList, bList);

    showToast({
      title: "Filters Saved",
      message: `Allowed: ${aList.length} | Blocked: ${bList.length}`,
      style: Toast.Style.Success,
    });
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Filters" onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Regex Rules"
        text="Enter one regular expression per line. If the Allowlist is used, EVERYTHING else is blocked."
      />
      <Form.TextArea
        id="allowlist"
        title="Allowlist"
        defaultValue={initialAllowlist}
        placeholder=".*(My Favorite Song).*$"
      />
      <Form.TextArea
        id="blocklist"
        title="Blocklist"
        defaultValue={initialBlocklist}
        placeholder=".*on Kitchen Speaker.*$"
      />

      <Form.Separator />

      <Form.Description title="Recent Tracks History" text={history} />
    </Form>
  );
}
