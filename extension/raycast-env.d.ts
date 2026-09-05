/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Enable Debug Commands - Show debug information when running debug commands */
  "enableDebugCommands": boolean,
  /** Local Home Assistant URL - Optional. If provided, the extension will attempt to connect here first before falling back to the external URL. */
  "haUrlLocal"?: string,
  /** External Home Assistant URL - The external URL of your Home Assistant instance (e.g. Nabu Casa) */
  "haUrl": string,
  /** Long-Lived Access Token - Your Home Assistant long-lived access token */
  "haToken": string,
  /** Include Only These Entities - Comma-separated list of media_player entity IDs to include. Leave blank for auto-detect. */
  "includeEntities"?: string,
  /** Developer Options - Log background state changes to the console. */
  "debugLogging": boolean
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `index` command */
  export type Index = ExtensionPreferences & {}
  /** Preferences accessible in the `favourites` command */
  export type Favourites = ExtensionPreferences & {}
  /** Preferences accessible in the `queue` command */
  export type Queue = ExtensionPreferences & {}
  /** Preferences accessible in the `filters` command */
  export type Filters = ExtensionPreferences & {}
  /** Preferences accessible in the `debug` command */
  export type Debug = ExtensionPreferences & {}
  /** Preferences accessible in the `debug-states` command */
  export type DebugStates = ExtensionPreferences & {}
  /** Preferences accessible in the `manage-stations` command */
  export type ManageStations = ExtensionPreferences & {}
  /** Preferences accessible in the `backup` command */
  export type Backup = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `index` command */
  export type Index = {}
  /** Arguments passed to the `favourites` command */
  export type Favourites = {}
  /** Arguments passed to the `queue` command */
  export type Queue = {}
  /** Arguments passed to the `filters` command */
  export type Filters = {}
  /** Arguments passed to the `debug` command */
  export type Debug = {}
  /** Arguments passed to the `debug-states` command */
  export type DebugStates = {}
  /** Arguments passed to the `manage-stations` command */
  export type ManageStations = {}
  /** Arguments passed to the `backup` command */
  export type Backup = {}
}

