import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

class StationConfig {
  static Future<File> get _configFile async {
    final dir = await getApplicationSupportDirectory();
    final path = '${dir.path}/.station_config.json';
    return File(path);
  }

  static Future<Map<String, dynamic>> loadConfig() async {
    try {
      final file = await _configFile;
      if (await file.exists()) {
        final contents = await file.readAsString();
        return jsonDecode(contents);
      }
    } catch (e) {
      print('Error loading station config: $e');
    }
    return {};
  }

  static Future<void> saveConfig(Map<String, dynamic> config) async {
    try {
      final file = await _configFile;
      await file.writeAsString(jsonEncode(config));
    } catch (e) {
      print('Error saving station config: $e');
    }
  }
}
