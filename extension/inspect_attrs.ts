import { getPreferenceValues } from "@raycast/api";
import { getHAConnection } from "./src/api";

async function main() {
  try {
    const conn = await getHAConnection();
    const states = await conn.sendMessagePromise({ type: "get_states" });
    const sonosPlayers = (states as any[]).filter(s => s.entity_id.startsWith("media_player."));
    for (const p of sonosPlayers) {
      if (p.state === "playing") {
        console.log(`\n=== ${p.attributes.friendly_name} ===`);
        console.log(`media_title:`, p.attributes.media_title);
        console.log(`media_artist:`, p.attributes.media_artist);
        console.log(`media_channel:`, p.attributes.media_channel);
        console.log(`media_album_name:`, p.attributes.media_album_name);
        console.log(`source:`, p.attributes.source);
        console.log(`media_content_id:`, p.attributes.media_content_id);
      }
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
main();
