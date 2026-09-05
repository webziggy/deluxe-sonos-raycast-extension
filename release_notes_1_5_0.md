# What's New in v1.5.0

### Advanced iTunes Parsing Mode for Radio Stations
Some radio streams broadcast their track titles inconsistently, e.g. `[Song Name] - [Artist Name]` instead of the standard `[Artist Name] - [Song Name]`. This wreaks havoc on the iTunes fetcher and makes your desktop notifications look messy!

In the **Manage Radio Stations** command, there is a brand new **iTunes Parsing Mode** dropdown! If a station broadcasts with a hyphen, you can now explicitly tell the Companion App how to extract it:
- **Auto**: Send the entire string to iTunes (the old behavior).
- **Incoming Format: [Artist] - [Song]**: Splits the string perfectly for the notification UI, and ensures high-accuracy iTunes matching.
- **Incoming Format: [Song] - [Artist]**: Instantly fixes backward radio stations, swapping the title and artist before querying iTunes and displaying your notification!

### Under the Hood
- **Standardized UI**: The Companion App now always restructures radio station metadata so your Desktop Notifications perfectly display `[Artist] - [Song]`, no matter how backward the station broadcasts it.
- **Smarter Search**: We updated the iTunes API queries to enforce `media=music`, ensuring we never accidentally fetch podcast or audiobook art for your radio streams.
- **Verbose Debugging**: The iTunes fetcher now logs its raw queries, parsed fields, and full iTunes URLs to `~/.sonos_companion_itunes.log` so you can easily peek under the hood!
