/**
 * @fileoverview Centralized Cache Manager for the Sonos Raycast Extension.
 * Handles reading, writing, and parsing of all data persisted to Raycast's local Cache.
 */

import { Cache } from "@raycast/api";

const cache = new Cache();

/**
 * Valid cache keys to ensure type safety across the extension.
 */
export type CacheKey =
  | "pinnedSpeaker"
  | "pinTrackName"
  | "favourites"
  | "trackHistories"
  | "lastTracks"
  | "lastFavourites"
  | "sonosPlayers";

/**
 * Generic Cache Manager object to enforce typed access.
 */
export const CacheManager = {
  /**
   * Reads a raw string value from the cache.
   * @param key The cache key to retrieve.
   * @returns The string value if it exists, otherwise undefined.
   */
  getString(key: CacheKey): string | undefined {
    return cache.get(key);
  },

  /**
   * Reads and parses a JSON object from the cache.
   * @param key The cache key to retrieve.
   * @param fallback The default value to return if the key doesn't exist or parsing fails.
   * @returns The parsed JSON object, or the fallback value.
   */
  getJSON<T>(key: CacheKey, fallback: T): T {
    const raw = cache.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch (e) {
      console.error(`CacheManager: Failed to parse JSON for key "${key}":`, e);
      return fallback;
    }
  },

  /**
   * Reads a boolean value from the cache.
   * @param key The cache key to retrieve.
   * @returns True if the cached string is strictly "true", false otherwise.
   */
  getBoolean(key: CacheKey): boolean {
    return cache.get(key) === "true";
  },

  /**
   * Writes a raw string or boolean value to the cache.
   * @param key The cache key to set.
   * @param value The string or boolean value to save.
   */
  set(key: CacheKey, value: string | boolean): void {
    cache.set(key, String(value));
  },

  /**
   * Serializes and writes a JSON object to the cache.
   * @param key The cache key to set.
   * @param value The object to serialize and save.
   */
  setJSON(key: CacheKey, value: any): void {
    cache.set(key, JSON.stringify(value));
  },

  /**
   * Removes a key from the cache completely.
   * @param key The cache key to remove.
   */
  remove(key: CacheKey): void {
    cache.remove(key);
  },

  /**
   * Checks if a key exists in the cache.
   * @param key The cache key to verify.
   * @returns True if the key exists, false otherwise.
   */
  has(key: CacheKey): boolean {
    return cache.has(key);
  }
};
