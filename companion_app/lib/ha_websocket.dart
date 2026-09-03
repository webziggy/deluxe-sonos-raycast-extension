import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:http/http.dart' as http;

class HAWebSocket {
  final Function(Map<String, dynamic>, bool isInitialSync) onTrackChange;
  WebSocketChannel? _channel;
  String? _url;
  String? _token;
  bool _isConnected = false;
  int _msgId = 1;
  int? _getStatesMsgId;

  final Map<String, String> _lastTracks = {};

  HAWebSocket({required this.onTrackChange});

  void connect(String url, String token) {
    _url = url;
    _token = token;
    _connectInternal();
  }

  void _connectInternal() {
    if (_url == null || _token == null) return;
    
    // Convert http/https to ws/wss
    var wsUrl = _url!.replaceFirst('http://', 'ws://').replaceFirst('https://', 'wss://');
    if (wsUrl.endsWith('/')) {
      wsUrl = wsUrl.substring(0, wsUrl.length - 1);
    }
    wsUrl = '$wsUrl/api/websocket';

    print('Connecting to HA WebSocket: $wsUrl');
    
    try {
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      _channel!.stream.listen(
        _handleMessage,
        onDone: _handleDisconnect,
        onError: (e) => _handleDisconnect(),
      );
    } catch (e) {
      print('HA WebSocket connection error: $e');
      _handleDisconnect();
    }
  }

  void _handleMessage(dynamic message) {
    final data = jsonDecode(message as String);
    final type = data['type'];

    if (type == 'auth_required') {
      _channel?.sink.add(jsonEncode({
        'type': 'auth',
        'access_token': _token,
      }));
    } else if (type == 'auth_ok') {
      _isConnected = true;
      print('HA WebSocket Authenticated!');
      _subscribeToEvents();
    } else if (type == 'auth_invalid') {
      print('HA WebSocket Auth Failed');
    } else if (type == 'event') {
      _handleEvent(data['event'], false);
    } else if (type == 'result' && data['id'] == _getStatesMsgId && data['success'] == true) {
      final states = data['result'] as List<dynamic>;
      for (var stateObj in states) {
        if (stateObj['entity_id'].toString().startsWith('media_player.')) {
          _handleEvent({
            'event_type': 'state_changed',
            'data': {
              'entity_id': stateObj['entity_id'],
              'new_state': stateObj
            }
          }, true);
        }
      }
    }
  }

  void _subscribeToEvents() {
    _channel?.sink.add(jsonEncode({
      'id': _msgId++,
      'type': 'subscribe_events',
      'event_type': 'state_changed'
    }));

    _getStatesMsgId = _msgId++;
    _channel?.sink.add(jsonEncode({
      'id': _getStatesMsgId,
      'type': 'get_states',
    }));
  }

  void _handleEvent(Map<String, dynamic> event, bool isInitialSync) async {
    if (event['event_type'] != 'state_changed') return;
    final data = event['data'];
    if (data == null) return;
    final entityId = data['entity_id'] as String;
    
    if (!entityId.startsWith('media_player.')) return;
    
    final newState = data['new_state'];
    if (newState == null) return;
    
    final attrs = newState['attributes'];
    if (attrs == null) return;

    final mediaTitle = attrs['media_title'];
    final mediaArtist = attrs['media_artist'];
    final state = newState['state'];
    
    String trackString = "";
    if (state == "playing" || state == "paused") {
      if (mediaTitle != null && mediaArtist != null) {
        trackString = "$mediaTitle - $mediaArtist";
      } else if (mediaTitle != null) {
        trackString = mediaTitle;
      }
    } else {
      trackString = state == "idle" ? "Idle" : "Offline";
    }

    if (trackString.isEmpty || trackString == "Idle" || trackString == "Offline") return;

    final lastTrack = _lastTracks[entityId];
    if (lastTrack != trackString) {
      _lastTracks[entityId] = trackString;
      
      if (state == 'playing') {
        final friendlyName = attrs['friendly_name'] ?? entityId;
        String? artUrl;
        if (attrs['entity_picture'] != null) {
          final basePath = _url!.endsWith('/') ? _url!.substring(0, _url!.length - 1) : _url!;
          final picturePath = attrs['entity_picture'].toString().startsWith('/') 
              ? attrs['entity_picture'] 
              : '/${attrs['entity_picture']}';
          artUrl = '$basePath$picturePath';
        }

        String? badgeUrl;
        
        // iTunes API Fetcher for Radio Streams
        // A stream typically has a missing mediaArtist, but a mediaTitle with a hyphen
        if ((mediaArtist == null || mediaArtist.trim().isEmpty) && 
             mediaTitle != null && 
             mediaTitle.contains(' - ')) {
           
           try {
             final query = Uri.encodeQueryComponent(mediaTitle);
             final url = Uri.parse('https://itunes.apple.com/search?term=$query&entity=song&limit=1');
             final response = await http.get(url).timeout(const Duration(milliseconds: 1500));
             
             if (response.statusCode == 200) {
               final json = jsonDecode(response.body);
               if (json['results'] != null && json['results'].length > 0) {
                 final artworkUrl100 = json['results'][0]['artworkUrl100'] as String?;
                 if (artworkUrl100 != null) {
                   badgeUrl = artUrl; // Set the original radio station logo as the badge
                   artUrl = artworkUrl100.replaceAll('100x100bb.jpg', '600x600bb.jpg'); // Upgrade to high-res
                 }
               }
             }
           } catch (e) {
             print('iTunes API fetch failed: $e');
           }
        }
        
        onTrackChange({
          'track': trackString,
          'speaker': friendlyName,
          'artUrl': artUrl,
          'badgeUrl': badgeUrl,
          'haToken': _token,
        }, isInitialSync);
      }
    }
  }

  void _handleDisconnect() {
    print('HA WebSocket Disconnected. Reconnecting in 5s...');
    _isConnected = false;
    _channel = null;
    Future.delayed(const Duration(seconds: 5), _connectInternal);
  }

  void dispose() {
    _channel?.sink.close();
  }
}
