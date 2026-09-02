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
