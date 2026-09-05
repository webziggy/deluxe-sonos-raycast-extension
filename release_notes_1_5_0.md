# What's New in v1.5.0

### Advanced iTunes Parsing Mode for Radio Stations
Some radio streams broadcast their track titles inconsistently, e.g. `[Song Name] - [Artist Name]` instead of the standard `[Artist Name] - [Song Name]`. This wreaks havoc on the iTunes fetcher and makes your desktop notifications look messy!

In the **Manage Radio Stations** command, there is a brand new **iTunes Parsing Mode** dropdown! If a station broadcasts with a hyphen, you can now explicitly tell the Companion App how to extract it:
- **Auto**: Send the entire string to iTunes (the old behavior).
- **Extract as: [Artist] - [Song]**: Splits the string perfectly for the notification UI, and ensures high-accuracy iTunes matching.
- **Extract as: [Song] - [Artist]**: Instantly fixes backward radio stations, swapping the title and artist before querying iTunes and displaying your notification!
