import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:http/http.dart' as http;
import 'station_config.dart';

class HAWebSocket {
  final Function(Map<String, dynamic>, bool isInitialSync) onTrackChange;
  WebSocketChannel? _channel;
  String? _url;
  String? _token;
  bool _isConnected = false;
  int _msgId = 1;
  int? _getStatesMsgId;
  Timer? _pingTimer;

  final Map<String, String> _lastTracks = {};
  List<dynamic> rawStatesCache = [];
  Map<String, Map<String, String>> observedStations = {};

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
      
      _pingTimer?.cancel();
      _pingTimer = Timer.periodic(const Duration(seconds: 30), (_) {
        if (_isConnected && _channel != null) {
          _channel!.sink.add(jsonEncode({'id': _msgId++, 'type': 'ping'}));
        }
      });
      
      _subscribeToEvents();
    } else if (type == 'auth_invalid') {
      print('HA WebSocket Auth Failed');
    } else if (type == 'event') {
      _handleEvent(data['event'], false);
    } else if (type == 'result' && data['id'] == _getStatesMsgId && data['success'] == true) {
      final states = data['result'] as List<dynamic>;
      rawStatesCache = states;
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
    
    // Update cache for debugging
    if (!isInitialSync && newState != null) {
      final existingIndex = rawStatesCache.indexWhere((s) => s['entity_id'] == entityId);
      if (existingIndex >= 0) {
        rawStatesCache[existingIndex] = newState;
      } else {
        rawStatesCache.add(newState);
      }
    }

    if (newState == null) return;
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
        // Radio streams often populate `media_channel` (e.g. "BBC Radio 2").
        // Or they pack "Artist - Song" into `mediaTitle`.
        // Sometimes integrations even swap artist and title (e.g. Title="Artist", Artist="Song").
        bool isLikelyRadioStream = false;
        String itunesQuery = '';
        String? channelName;
        
        if (attrs['media_channel'] != null) {
          channelName = attrs['media_channel'];
          isLikelyRadioStream = true;
          itunesQuery = "${mediaTitle ?? ''} ${mediaArtist ?? ''}".trim();
        } else if (mediaTitle != null && mediaTitle.contains(' - ')) {
          channelName = 'Unknown ICY Stream';
          isLikelyRadioStream = true;
          itunesQuery = mediaTitle;
        } else if ((mediaArtist == null || mediaArtist.trim().isEmpty) && mediaTitle != null) {
          channelName = 'Unknown ICY Stream';
          isLikelyRadioStream = true;
          itunesQuery = mediaTitle;
        }

        if (isLikelyRadioStream) {
          // Record observation for Raycast Station Manager
          if (channelName != null) {
            observedStations[channelName] = {
              'title': mediaTitle ?? '',
              'artist': mediaArtist ?? ''
            };
          }

          if (itunesQuery.isNotEmpty) {
            // Check station config
            final stationConfig = await StationConfig.loadConfig();
            final configForChannel = stationConfig[channelName] ?? {};
            
            final skipItunes = configForChannel['skipItunes'] == true;
            final customBadge = configForChannel['badgeUrl'] as String?;
            final parseStyle = configForChannel['itunesParseStyle'] as String?; // 'auto', 'artist_title', 'title_artist'

            if (!skipItunes) {
              try {
                String cleanQuery = itunesQuery.replaceAll(' - ', ' ').replaceAll(RegExp(r'\s+'), ' ');
                
                // If a specific parse style is set and a hyphen exists, we can extract the exact parts
                if (parseStyle != null && parseStyle != 'auto' && itunesQuery.contains(' - ')) {
                  final parts = itunesQuery.split(' - ');
                  if (parts.length >= 2) {
                    final part1 = parts[0].trim();
                    final part2 = parts.sublist(1).join(' - ').trim(); // In case there are multiple hyphens
                    
                    String parsedArtist = '';
                    String parsedTitle = '';
                    
                    if (parseStyle == 'artist_title') {
                      parsedArtist = part1;
                      parsedTitle = part2;
                    } else if (parseStyle == 'title_artist') {
                      parsedTitle = part1;
                      parsedArtist = part2;
                    }
                    
                    // Rebuild the query cleanly for iTunes
                    cleanQuery = "$parsedTitle $parsedArtist".replaceAll(RegExp(r'\s+'), ' ');
                    
                    // AND we can beautifully format the track string for the notification itself!
                    trackString = "$parsedTitle - $parsedArtist";
                  }
                }
                final query = Uri.encodeQueryComponent(cleanQuery);
                final url = Uri.parse('https://itunes.apple.com/search?term=$query&entity=song&limit=1');
                final response = await http.get(url).timeout(const Duration(milliseconds: 1500));
                
                if (response.statusCode == 200) {
                  final json = jsonDecode(response.body);
                  if (json['results'] != null && json['results'].length > 0) {
                    final artworkUrl100 = json['results'][0]['artworkUrl100'] as String?;
                    if (artworkUrl100 != null) {
                      badgeUrl = customBadge ?? artUrl; // Set to custom badge or fallback to HA generic art
                      artUrl = artworkUrl100.replaceAll('100x100bb.jpg', '600x600bb.jpg'); 
                    }
                  }
                }
              } catch (e) {
                print('iTunes API fetch failed: $e');
              }
            } else {
              // We skipped iTunes, but they might still want a custom badge?
              // Usually if they skip iTunes, it's because artUrl is already high-res song art.
              // So if they provided a custom badge, let's use it!
              if (customBadge != null) {
                badgeUrl = customBadge;
              }
            }
          }
        }
        
        onTrackChange({
          'track': trackString,
          'speaker': friendlyName,
          'entityId': entityId,
          'artUrl': artUrl,
          'badgeUrl': badgeUrl,
          'haToken': _token,
        }, isInitialSync);
      }
    }
  }

  void _handleDisconnect() {
    print('HA WebSocket Disconnected. Reconnecting in 5s...');
    _pingTimer?.cancel();
    _isConnected = false;
    _channel = null;
    Future.delayed(const Duration(seconds: 5), _connectInternal);
  }

  void dispose() {
    _pingTimer?.cancel();
    _channel?.sink.close();
  }
}
