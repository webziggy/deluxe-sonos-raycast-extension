# What's New in v1.4.0

### Native Favourites Sub-menus in the Menu Bar
Your favourites in the Raycast menu bar are now beautifully grouped into native macOS sub-menus (Playlists, Radio, etc.). To keep things incredibly fast and battery-efficient, the menu bar perfectly syncs with the cache from your Favourites Grid command without making any extra network requests!

### "Play Last" Quick Action
If your pinned speaker isn't playing anything, a dynamic **Play Last** button now appears right above the Play/Pause controls, allowing you to instantly resume whatever favourite or station you were listening to previously without diving through menus.

### Menu Bar Stability & Error Boundaries
Completely overhauled the native caching integration to prevent the Menu Bar from occasionally freezing on corrupted memory states. Added a global Error Boundary directly into the Raycast rendering engine—if any future crashes occur, the Menu Bar icon will automatically switch to displaying a visual crash report instead of silently locking up!

### Filter Polish
When a paused track hits the regex blocklist, the menu bar now cleanly displays "Nothing playing" instead of a long notification error, keeping your UI clean.
