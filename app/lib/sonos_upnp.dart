import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class SonosUPnP {
  static final Map<String, String> _ipCache = {};

  // Simple SSDP discovery for Sonos speakers
  static Future<String?> discoverSpeakerIP(String friendlyName) async {
    if (_ipCache.containsKey(friendlyName)) return _ipCache[friendlyName];
    // This is a naive implementation. In a real app we'd wait a bit for responses.
    // For now we will broadcast and wait up to 2 seconds.
    final socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0);
    socket.broadcastEnabled = true;

    final message = utf8.encode(
      'M-SEARCH * HTTP/1.1\r\n'
      'HOST: 239.255.255.250:1900\r\n'
      'MAN: "ssdp:discover"\r\n'
      'MX: 1\r\n'
      'ST: urn:schemas-upnp-org:device:ZonePlayer:1\r\n\r\n'
    );

    socket.send(message, InternetAddress('239.255.255.250'), 1900);

    final completer = Completer<String?>();
    final foundIps = <String>[];

    socket.listen((RawSocketEvent event) async {
      if (event == RawSocketEvent.read) {
        Datagram? d = socket.receive();
        if (d != null) {
          final ip = d.address.address;
          if (!foundIps.contains(ip)) {
            foundIps.add(ip);
            // We got an IP. Let's query its device description to check the room name.
            try {
              final res = await http.get(Uri.parse('http://$ip:1400/xml/device_description.xml')).timeout(const Duration(seconds: 1));
              if (res.body.contains('<roomName>$friendlyName</roomName>')) {
                _ipCache[friendlyName] = ip;
                if (!completer.isCompleted) {
                  completer.complete(ip);
                }
              }
            } catch (_) {}
          }
        }
      }
    });

    // Timeout after 2 seconds
    Future.delayed(const Duration(seconds: 2), () {
      if (!completer.isCompleted) {
        completer.complete(null);
      }
      socket.close();
    });

    return completer.future;
  }

  static Future<String?> getSleepTimer(String ip) async {
    final soapBody = '''
<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetRemainingSleepTimerDuration xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:GetRemainingSleepTimerDuration>
  </s:Body>
</s:Envelope>
'''.trim();

    try {
      final res = await http.post(
        Uri.parse('http://$ip:1400/MediaRenderer/AVTransport/Control'),
        headers: {
          'Content-Type': 'text/xml; charset="utf-8"',
          'SOAPACTION': '"urn:schemas-upnp-org:service:AVTransport:1#GetRemainingSleepTimerDuration"'
        },
        body: soapBody,
      ).timeout(const Duration(seconds: 2));

      if (res.statusCode == 200) {
        final match = RegExp(r'<RemainingSleepTimerDuration>(.+?)</RemainingSleepTimerDuration>').firstMatch(res.body);
        if (match != null) {
          final timeStr = match.group(1);
          if (timeStr == "" || timeStr == "00:00:00") return null;
          return timeStr; // e.g. 00:15:00
        }
      }
    } catch (_) {}
    return null;
  }
}
