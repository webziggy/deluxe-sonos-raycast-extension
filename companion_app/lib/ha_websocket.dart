import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

class HAWebSocket {
  final Function(Map<String, dynamic>) onTrackChange;
  WebSocketChannel? _channel;
  String? _url;
  String? _token;
  bool _isConnected = false;
  int _msgId = 1;

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
      _handleEvent(data['event']);
    }
  }

  void _subscribeToEvents() {
    _channel?.sink.add(jsonEncode({
      'id': _msgId++,
      'type': 'subscribe_events',
      'event_type': 'state_changed'
    }));
  }

  void _handleEvent(Map<String, dynamic> event) {
    if (event['event_type'] != 'state_changed') return;
    final data = event['data'];
    if (data == null) return;
    final entityId = data['entity_id'] as String;
    
    if (!entityId.startsWith('media_player.')) return;
    
    final newState = data['new_state'];
    if (newState == null) return;
    
    // We only care about Sonos, but for simplicity we'll process all media_players and rely on attributes
    final attrs = newState['attributes'];
    if (attrs == null) return;

    final mediaTitle = attrs['media_title'];
    final mediaArtist = attrs['media_artist'];
    final state = newState['state'];
    
    // Build full track string
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
      
      // Only fire popup if it's playing
      if (state == 'playing') {
        final friendlyName = attrs['friendly_name'] ?? entityId;
        final artUrl = attrs['entity_picture'] != null ? '$_url${attrs['entity_picture']}' : null;
        
        onTrackChange({
          'track': trackString,
          'speaker': friendlyName,
          'artUrl': artUrl,
          'haToken': _token,
        });
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
