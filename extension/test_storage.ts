import { LocalStorage } from "@raycast/api";

export default async function Command() {
    await LocalStorage.setItem("test", "hello");
    console.log(await LocalStorage.getItem("test"));
}
