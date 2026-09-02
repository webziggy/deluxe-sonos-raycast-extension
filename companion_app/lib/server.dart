import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as io;
import 'package:shelf_router/shelf_router.dart';
import 'package:uuid/uuid.dart';

class LocalServer {
  late HttpServer _server;
  late String _secretToken;

  Future<void> start() async {
    _secretToken = Uuid().v4();

    final router = Router();

    // Health check endpoint
    router.get('/health', (Request request) {
      return Response.ok(jsonEncode({'status': 'ok'}), headers: {'content-type': 'application/json'});
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
        // TODO: Trigger Flutter UI popup
        return Response.ok(jsonEncode({'success': true}));
      } catch (e) {
        return Response.badRequest(body: 'Invalid JSON payload');
      }
    });

    // We bind to port 0 to let the OS assign an available port automatically to avoid conflicts
    _server = await io.serve(router.call, '127.0.0.1', 0);
    print('Server listening on port ${_server.port}');

    await _writeAuthFile();
  }

  Future<void> _writeAuthFile() async {
    final dir = await getApplicationSupportDirectory();
    final file = File('${dir.path}/.sonos_companion_auth.json');
    
    final data = {
      'port': _server.port,
      'token': _secretToken,
    };
    
    await file.writeAsString(jsonEncode(data));
    print('Auth file written to: ${file.path}');
  }

  Future<void> stop() async {
    await _server.close();
    final dir = await getApplicationSupportDirectory();
    final file = File('${dir.path}/.sonos_companion_auth.json');
    if (await file.exists()) {
      await file.delete();
    }
  }
}
