import { Detail, LocalStorage } from "@raycast/api";
import { useEffect, useState } from "react";

export default function Command() {
  const [text, setText] = useState("Loading...");

  useEffect(() => {
    async function load() {
      const items = await LocalStorage.allItems();
      setText(JSON.stringify(items, null, 2));
    }
    load();
  }, []);

  return <Detail markdown={`\`\`\`json\n${text}\n\`\`\``} />;
}
