# Home Assistant Metadata Quirks

When integrating Sonos with Home Assistant, the metadata emitted by the `media_player` domain varies wildly depending on whether a static track (e.g., Spotify/Amazon Music) or a live radio stream (e.g., TuneIn, BBC, Rayo) is playing. 

Because live ICY radio metadata has no strict universal formatting standard, different stations broadcast their track information in different layouts, and Home Assistant’s parsing layer often struggles to normalize them correctly.

This document outlines the known quirks we've encountered and how the Deluxe Sonos Companion App gracefully handles them.

## 1. Live Radio Streams (ICY Metadata)

When playing a live radio stream, the most reliable indicator is the `media_channel` attribute. 

### Greatest Hits Radio (GHR) via Rayo
**Quirk: Backwards Metadata & Missing Artist**

Sometimes the station drops the song entirely during an advert, resulting in:
```json
"media_title": "Greatest Hits Radio (Manchester and the North West)",
"media_artist": null,
"media_channel": "Greatest Hits Radio (Manchester and the North West)"
```

When a song is playing, GHR frequently sends the metadata backwards:
```json
"media_title": "Andrew Gold",
"media_artist": "Lonely Boy",
"media_channel": "Greatest Hits Radio (Manchester and the North West)"
```
*(Notice the Artist is in the Title field, and the Title is in the Artist field).*

### BBC Radio 2
**Quirk: Correct Order, Complex Stream ID**

Unlike GHR, BBC Radio 2 actually sends the ICY metadata in the correct order:
```json
"media_title": "I Saw The Light",
"media_artist": "Todd Rundgren",
"media_channel": "Radio 2 • Radio 2",
"media_content_id": "x-sonosapi-hls:stations%7eplayable%7e%7ebbc_radio_two..."
```

### The Solution: Apple Music (iTunes) API Fetcher
To provide high-resolution album art for radio streams (since Sonos usually only provides the static station logo), the Companion App intercepts the Home Assistant state change and queries the iTunes Search API.

Because we cannot rely on the `media_title` and `media_artist` fields being in the correct order (as seen with GHR), the Companion App bypasses the order entirely. 

**Logic Flow:**
1. If `media_channel != null`, we flag it as a guaranteed live radio stream.
2. We concatenate both fields into a single space-separated string (e.g., `"Andrew Gold Lonely Boy"` or `"I Saw The Light Todd Rundgren"`).
3. We send this string to the iTunes API `term` parameter.
4. Apple's search engine is robust enough to resolve the correct song regardless of the word order.
5. If a match is found, we swap out the main notification image for the high-res Apple Music artwork, and render the original generic station logo as a small badge in the corner.
6. If no match is found (e.g. an advert/jingle is playing), it silently falls back to the native station logo.

## 2. Static Playlists (Spotify / Amazon Music)

When playing standard on-demand music (like an Amazon Music playlist), the metadata behaves as expected:

```json
"media_content_id": "x-sonosapi-hls-static:catalog%3atrack%3aasin%3aB0GMTLRH66...",
"media_title": "Tuolumne",
"media_artist": "Duce ",
"media_album_name": "Tuolumne",
"media_playlist": "Hypnotic and Melodic"
```

**Crucial Observation:** Notice that the `media_channel` attribute is **completely absent**.

Because `media_channel` only appears for live radio streams, our detection logic `if (attrs['media_channel'] != null)` perfectly filters out static playlists. This ensures we never accidentally trigger the iTunes API for a Spotify or Amazon Music track, saving bandwidth and reliably displaying the native high-res artwork provided directly by the service.
