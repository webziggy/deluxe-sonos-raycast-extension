import 'dart:io';
void main() async {
  final dir = Directory.systemTemp.createTempSync('sonos_test');
  final file = File('/tmp/sonos_raycast_port');
  if (file.existsSync()) {
    print('Port: ${file.readAsStringSync()}');
  } else {
    print('No port file');
  }
}
