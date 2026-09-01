/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Home Assistant URL - The URL of your Home Assistant instance */
  "haUrl": string,
  /** Long-Lived Access Token - Your Home Assistant long-lived access token */
  "haToken": string,
  /** Include Only These Entities - Comma-separated list of media_player entity IDs to include. Leave blank for auto-detect. */
  "includeEntities"?: string,
  /** Menu Bar Appearance - Briefly show the track name in the Mac menu bar when a new song starts playing. */
  "flashTrackName": boolean,
  /** Notifications - Show a brief popup notification when a new track starts. */
  "undefined": unknown,
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
}

declare namespace Arguments {
  /** Arguments passed to the `index` command */
  export type Index = {}
  /** Arguments passed to the `favourites` command */
  export type Favourites = {}
  /** Arguments passed to the `queue` command */
  export type Queue = {}
}

