import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

class AppConfig {
  static Future<File> get _file async {
    final dir = await getApplicationSupportDirectory();
    return File('${dir.path}/config.json');
  }

  static Future<void> saveConfig(String haUrl, String haToken) async {
    final file = await _file;
    if (!await file.parent.exists()) {
      await file.parent.create(recursive: true);
    }
    final existing = await loadConfig();
    await file.writeAsString(jsonEncode({
      ...existing ?? {},
      'haUrl': haUrl,
      'haToken': haToken,
    }));
  }

  static Future<void> saveNotificationsEnabled(bool enabled) async {
    final file = await _file;
    if (!await file.parent.exists()) {
      await file.parent.create(recursive: true);
    }
    final existing = await loadConfig();
    await file.writeAsString(jsonEncode({
      ...existing ?? {},
      'notificationsEnabled': enabled,
    }));
  }

  static Future<void> saveAlignment(String alignment) async {
    final file = await _file;
    if (!await file.parent.exists()) {
      await file.parent.create(recursive: true);
    }
    final existing = await loadConfig();
    await file.writeAsString(jsonEncode({
      ...existing ?? {},
      'alignment': alignment,
    }));
  }

  static Future<void> saveFilters(List<String> allowlist, List<String> blocklist) async {
    final file = await _file;
    if (!await file.parent.exists()) {
      await file.parent.create(recursive: true);
    }
    final existing = await loadConfig();
    await file.writeAsString(jsonEncode({
      ...existing ?? {},
      'allowlist': allowlist,
      'blocklist': blocklist,
    }));
  }

  static Future<void> saveCardSize(String size) async {
    final file = await _file;
    if (!await file.parent.exists()) {
      await file.parent.create(recursive: true);
    }
    final existing = await loadConfig();
    await file.writeAsString(jsonEncode({
      ...existing ?? {},
      'cardSize': size,
    }));
  }
  static Future<void> saveFont(String font) async {
    final file = await _file;
    if (!await file.parent.exists()) {
      await file.parent.create(recursive: true);
    }
    final existing = await loadConfig();
    await file.writeAsString(jsonEncode({
      ...existing ?? {},
      'font': font,
    }));
  }

  static Future<void> savePinnedSpeaker(String? speaker) async {
    final file = await _file;
    if (!await file.parent.exists()) {
      await file.parent.create(recursive: true);
    }
    final existing = await loadConfig();
    await file.writeAsString(jsonEncode({
      ...existing ?? {},
      'pinnedSpeaker': speaker,
    }));
  }

  static Future<Map<String, dynamic>?> loadConfig() async {
    try {
      final file = await _file;
      if (await file.exists()) {
        final data = await file.readAsString();
        return jsonDecode(data);
      }
    } catch (_) {}
    return null;
  }
}
