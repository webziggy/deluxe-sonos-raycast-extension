import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

class AppConfig {
  static Map<String, dynamic>? _memCache;
  static bool _isLoaded = false;
  static Future<dynamic>? _writeLock;

  static Future<File> get _file async {
    final dir = await getApplicationSupportDirectory();
    return File('${dir.path}/config.json');
  }

  static Future<Map<String, dynamic>?> loadConfig() async {
    if (_isLoaded) return _memCache;
    try {
      final file = await _file;
      if (await file.exists()) {
        final data = await file.readAsString();
        _memCache = jsonDecode(data);
      }
    } catch (_) {}
    _isLoaded = true;
    return _memCache;
  }

  static Future<void> _updateAndSave(Map<String, dynamic> updates) async {
    final existing = await loadConfig() ?? {};
    final next = { ...existing, ...updates };
    _memCache = next; // Synchronous update for memory

    // Await any pending writes to prevent file corruption
    while (_writeLock != null) {
      await _writeLock;
    }
    
    var completer = _writeToDisk(next);
    _writeLock = completer;
    await completer;
    _writeLock = null;
  }

  static Future<void> _writeToDisk(Map<String, dynamic> data) async {
    final file = await _file;
    if (!await file.parent.exists()) {
      await file.parent.create(recursive: true);
    }
    await file.writeAsString(jsonEncode(data), flush: true);
  }

  static Future<void> saveConfig(String haUrl, String haToken) async {
    await _updateAndSave({'haUrl': haUrl, 'haToken': haToken});
  }

  static Future<void> saveNotificationsEnabled(bool enabled) async {
    await _updateAndSave({'notificationsEnabled': enabled});
  }

  static Future<void> saveAlignment(String alignment) async {
    await _updateAndSave({'alignment': alignment});
  }

  static Future<void> saveFilters(List<String> allowlist, List<String> blocklist) async {
    await _updateAndSave({'allowlist': allowlist, 'blocklist': blocklist});
  }

  static Future<void> saveCardSize(String size) async {
    await _updateAndSave({'cardSize': size});
  }

  static Future<void> saveFont(String font) async {
    await _updateAndSave({'font': font});
  }

  static Future<void> savePinnedSpeaker(String? speaker) async {
    await _updateAndSave({'pinnedSpeaker': speaker});
  }
}
