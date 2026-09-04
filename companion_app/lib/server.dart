import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as io;
import 'package:shelf_router/shelf_router.dart';
import 'package:uuid/uuid.dart';
import 'sonos_upnp.dart';
import 'config.dart';
import 'station_config.dart';

class LocalServer {
  late HttpServer _server;
  late String _secretToken;
  final Function(String haUrl, String haToken) onConfigUpdate;
  final List<Map<String, dynamic>> trackHistory = [];
  Future<void> Function()? rebuildMenuCallback;
  List<dynamic> Function()? getDebugStates;
  Map<String, Map<String, String>> Function()? getObservedStations;

  final _notifyController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get onNotify => _notifyController.stream;

  Timer? _rebuildTimer;

  void cancelRebuildTimer() {
    _rebuildTimer?.cancel();
  }

  void startRebuildTimer(Future<void> Function()? callback) {
    _rebuildTimer = Timer(const Duration(milliseconds: 500), () {
      if (callback != null) callback();
    });
  }

  void triggerNotifyLocally(Map<String, dynamic> data) {
    _notifyController.add(data);
  }

  LocalServer({required this.onConfigUpdate});

  Future<void> start() async {
    _secretToken = Uuid().v4();

    final router = Router();

    // Health check endpoint
    router.get('/health', (Request request) {
      return Response.ok(jsonEncode({'status': 'ok'}), headers: {'Content-Type': 'application/json'});
    });

    router.post('/config', (Request request) async {
      final auth = request.headers['authorization'];
      if (auth != 'Bearer $_secretToken') {
        return Response.forbidden('Invalid or missing token');
      }

      try {
        final payload = await request.readAsString();
        final data = jsonDecode(payload);
        final haUrl = data['haUrl'] as String;
        final haToken = data['haToken'] as String;
        
        onConfigUpdate(haUrl, haToken);

        return Response.ok(jsonEncode({'success': true}));
      } catch (e) {
        return Response.badRequest(body: 'Invalid JSON payload');
      }
    });

    router.get('/debug_states', (Request request) {
      final states = getDebugStates?.call() ?? [];
      return Response.ok(jsonEncode(states), headers: {'Content-Type': 'application/json'});
    });

    router.get('/observed_stations', (Request request) {
      final stations = getObservedStations?.call() ?? {};
      return Response.ok(jsonEncode(stations), headers: {'Content-Type': 'application/json'});
    });

    router.get('/station_config', (Request request) async {
      final auth = request.headers['authorization'];
      if (auth != 'Bearer $_secretToken') {
        return Response.forbidden('Invalid or missing token');
      }
      final config = await StationConfig.loadConfig();
      return Response.ok(jsonEncode(config), headers: {'Content-Type': 'application/json'});
    });

    router.post('/station_config', (Request request) async {
      final auth = request.headers['authorization'];
      if (auth != 'Bearer $_secretToken') {
        return Response.forbidden('Invalid or missing token');
      }
      try {
        final payload = await request.readAsString();
        final data = jsonDecode(payload);
        await StationConfig.saveConfig(Map<String, dynamic>.from(data));
        return Response.ok(jsonEncode({'success': true}));
      } catch (e) {
        return Response.internalServerError(body: e.toString());
      }
    });

    // Notify endpoint
    router.post('/notify', (Request request) async {
      final auth = request.headers['authorization'];
      if (auth != 'Bearer $_secretToken') {
        return Response.forbidden('Invalid or missing token');
      }

      try {
        final payload = await request.readAsString();
        final data = jsonDecode(payload);
        print('Received notification request: $data');
        _notifyController.add(data);
        return Response.ok(jsonEncode({'success': true}));
      } catch (e) {
        return Response.badRequest(body: 'Invalid JSON payload');
      }
    });

    // Sleep Timer UPnP endpoint
    router.get('/sleep-timer', (Request request) async {
      final auth = request.headers['authorization'];
      if (auth != 'Bearer $_secretToken') {
        return Response.forbidden('Invalid or missing token');
      }

      final speakerName = request.url.queryParameters['speaker'];
      if (speakerName == null) return Response.badRequest(body: 'Missing speaker name');

      final ip = await SonosUPnP.discoverSpeakerIP(speakerName);
      if (ip == null) return Response.notFound('Speaker not found on local network');

      final timeStr = await SonosUPnP.getSleepTimer(ip);
      return Response.ok(jsonEncode({'remaining': timeStr}), headers: {'content-type': 'application/json'});
    });

    // Config endpoint
    router.post('/config', (Request request) async {
      final auth = request.headers['authorization'];
      if (auth != 'Bearer $_secretToken') {
        return Response.forbidden('Invalid or missing token');
      }

      try {
        final payload = await request.readAsString();
        final data = jsonDecode(payload);
        final haUrl = data['haUrl'];
        final haToken = data['haToken'];
        
        if (haUrl != null && haToken != null) {
          onConfigUpdate(haUrl, haToken);
          return Response.ok(jsonEncode({'success': true}));
        }
        return Response.badRequest(body: 'Missing haUrl or haToken');
      } catch (e) {
        return Response.badRequest(body: 'Invalid JSON payload');
      }
    });

    // Filters endpoint
    router.get('/filters', (Request request) async {
      final auth = request.headers['authorization'];
      if (auth != 'Bearer $_secretToken') {
        return Response.forbidden('Invalid or missing token');
      }
      final config = await AppConfig.loadConfig();
      return Response.ok(jsonEncode({
        'allowlist': config?['allowlist'] ?? [],
        'blocklist': config?['blocklist'] ?? [],
      }), headers: {'content-type': 'application/json'});
    });

    router.post('/filters', (Request request) async {
      final auth = request.headers['authorization'];
      if (auth != 'Bearer $_secretToken') {
        return Response.forbidden('Invalid or missing token');
      }
      try {
        final payload = await request.readAsString();
        final data = jsonDecode(payload);
        List<String> allowlist = List<String>.from(data['allowlist'] ?? []);
        List<String> blocklist = List<String>.from(data['blocklist'] ?? []);
        await AppConfig.saveFilters(allowlist, blocklist);
        return Response.ok(jsonEncode({'success': true}));
      } catch (e) {
        return Response.badRequest(body: 'Invalid JSON payload');
      }
    });


    // Pinned Speaker endpoint
    router.post('/pinned_speaker', (Request request) async {
      final auth = request.headers['authorization'];
      if (auth != 'Bearer $_secretToken') {
        return Response.forbidden('Invalid or missing token');
      }
      try {
        final payload = await request.readAsString();
        final data = jsonDecode(payload);
        final speaker = data['speaker'] as String?;
        await AppConfig.savePinnedSpeaker(speaker);
        
        // Notify the app to rebuild the menu to show the active speaker
        startRebuildTimer(rebuildMenuCallback);
        
        return Response.ok(jsonEncode({'success': true}));
      } catch (e) {
        return Response.badRequest(body: 'Invalid JSON payload');
      }
    });

    // History endpoint
    router.get('/history', (Request request) async {
      final auth = request.headers['authorization'];
      if (auth != 'Bearer $_secretToken') {
        return Response.forbidden('Invalid or missing token');
      }
      return Response.ok(jsonEncode({'history': trackHistory}), headers: {'content-type': 'application/json'});
    });

    // We bind to port 0 to let the OS assign an available port automatically to avoid conflicts
    _server = await io.serve(router.call, '127.0.0.1', 0);
    print('Server listening on port ${_server.port}');

    await _writeAuthFile();
  }

  String _getAuthFilePath() {
    String? home = Platform.environment['HOME'] ?? Platform.environment['USERPROFILE'];
    return '$home/.sonos_companion_auth.json';
  }

  Future<void> _writeAuthFile() async {
    final file = File(_getAuthFilePath());
    
    final data = {
      'port': _server.port,
      'token': _secretToken,
    };
    
    await file.writeAsString(jsonEncode(data));
    print('Auth file written to: ${file.path}');
  }

  Future<void> stop() async {
    await _server.close();
    final file = File(_getAuthFilePath());
    if (await file.exists()) {
      await file.delete();
    }
  }
}
