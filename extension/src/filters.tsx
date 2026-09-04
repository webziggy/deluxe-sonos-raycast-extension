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
  const [allowlist, setAllowlist] = useState<string>("");
  const [blocklist, setBlocklist] = useState<string>("");
  const [history, setHistory] = useState<string>("Loading...");

  useEffect(() => {
    async function load() {
      const a = await LocalStorage.getItem<string>("allowlist");
      const b = await LocalStorage.getItem<string>("blocklist");
      if (a) setAllowlist(a);
      if (b) setBlocklist(b);

      const hist = await getCompanionHistory();
      if (hist.length > 0) {
        setHistory(
          hist.map((h: any) => `• ${h.track} on ${h.speaker}`).join("\n"),
        );
      } else {
        setHistory("No recent tracks recorded yet.");
      }
    }
    load();
  }, []);

  async function submit(values: any) {
    // Raycast sometimes omits fully controlled components from the 'values' payload.
    // We fall back to the React state variables to guarantee we have the exact text.
    const aStr = values.allowlist ?? allowlist ?? "";
    const bStr = values.blocklist ?? blocklist ?? "";

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

    showToast({ title: "Filters Saved", style: Toast.Style.Success });
  }

  return (
    <Form
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
        value={allowlist}
        onChange={setAllowlist}
        placeholder=".*(My Favorite Song).*$"
      />
      <Form.TextArea
        id="blocklist"
        title="Blocklist"
        value={blocklist}
        onChange={setBlocklist}
        placeholder=".*on Kitchen Speaker.*$"
      />

      <Form.Separator />

      <Form.Description title="Recent Tracks History" text={history} />
    </Form>
  );
}
