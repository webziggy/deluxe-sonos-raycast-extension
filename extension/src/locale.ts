export function getSpelling(
  word: "Favourite" | "Favourites" | "favourite" | "favourites",
): string {
  // Use Node.js Intl API to determine locale. On macOS this defaults to the system region for the user.
  const locale = Intl.DateTimeFormat().resolvedOptions().locale; // e.g. "en-US", "en-GB"
  const isUS =
    locale.includes("US") ||
    locale === "en" ||
    process.env.LANG?.includes("US");

  if (isUS) {
    if (word === "Favourite") return "Favorite";
    if (word === "Favourites") return "Favorites";
    if (word === "favourite") return "favorite";
    if (word === "favourites") return "favorites";
  }
  return word;
}
