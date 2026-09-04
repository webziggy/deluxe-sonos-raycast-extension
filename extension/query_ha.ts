import { getPreferenceValues } from "@raycast/api";
// We can't easily query HA without the token, which is inside Raycast's secure store.
// Let's just grep the dev.log for "number." or "sensor." or "switch."
