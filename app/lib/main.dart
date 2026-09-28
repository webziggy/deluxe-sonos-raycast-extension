import 'dart:ui';
import 'dart:async';
import 'windows/notification.dart';
import 'windows/popover.dart';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:uuid/uuid.dart';
import 'package:desktop_multi_window/desktop_multi_window.dart';
import 'package:window_manager/window_manager.dart';
import 'package:tray_manager/tray_manager.dart';

import 'server.dart';
import 'ha_websocket.dart';
import 'config.dart';

late LocalServer globalServer;
late HAWebSocket haWebSocket;
WindowController? _popoverWindow;
String? _notificationWindowId;

class MyHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback = (X509Certificate cert, String host, int port) => true;
  }
}

Future<void> main(List<String> args) async {
  WidgetsFlutterBinding.ensureInitialized();
  HttpOverrides.global = MyHttpOverrides();

  if (args.isNotEmpty && args.first == 'multi_window') {
    final windowId = args[1];
    final argument = args[2].isEmpty ? <String, dynamic>{} : (jsonDecode(args[2]) as Map).cast<String, dynamic>();
    final windowType = argument['type'] as String?;


    if (windowType == 'notification') {
      runApp(NotificationSubWindow(windowId: windowId, argument: argument));
    } else if (windowType == 'popover') {
      runApp(PopoverSubWindow(windowId: windowId, argument: argument));
    }
  } else {
    // 0. Load Configuration
    final config = await AppConfig.loadConfig();
    
    // 1. Initialize HA WebSocket and local server in the MAIN window
    haWebSocket = HAWebSocket(onTrackChange: (trackData, isInitialSync, isNewTrack) async {
      final trackName = trackData['track'] ?? 'Unknown Track';
      final speakerName = trackData['speaker'] ?? 'Unknown Speaker';
      
      // Update the local history array (for the Raycast HTTP API)
      if (isNewTrack) {
        globalServer.trackHistory.insert(0, trackData);
        if (globalServer.trackHistory.length > 10) {
          globalServer.trackHistory.removeLast();
        }
      }

      // If the Popover window exists, send the rich state via IPC
      if (_popoverWindow != null) {
        final currentConfig = await AppConfig.loadConfig();
        await _popoverWindow!.invokeMethod('update_state', {
           'track': trackData,
           'history': globalServer.trackHistory,
           'speakers': haWebSocket.availableSpeakers,
           'pinnedSpeaker': currentConfig?['pinnedSpeaker'],
        });
      }

      final currentConfig = await AppConfig.loadConfig();
      if (!isInitialSync && isNewTrack && (currentConfig?['notificationsEnabled'] ?? true) == true) {
        if (_notificationWindowId != null) {
          try {
            await WindowController.fromWindowId(_notificationWindowId!).invokeMethod('update_track', trackData);
          } catch (_) {}
        } else {
          final window = await WindowController.create(WindowConfiguration(arguments: jsonEncode({
            'type': 'notification',
            ...trackData,
          })));
          _notificationWindowId = window.windowId.toString();
          window.show();
        }
      }
    });
    
    final haUrl = config?['haUrl'] as String?;
    final haToken = config?['haToken'] as String?;
    if (haUrl != null && haToken != null) {
      haWebSocket.connect(haUrl, haToken);
    }
    
    globalServer = LocalServer(onConfigUpdate: (newUrl, newToken) async {
      print('Received HA config from Raycast. Saving and connecting...');
      await AppConfig.saveConfig(newUrl, newToken);
      haWebSocket.connect(newUrl, newToken);
    });
    globalServer.getDebugStates = () => haWebSocket.rawStatesCache;
    
    await globalServer.start();

    runApp(const MainAppWindow());
  }
}

class MainAppWindow extends StatefulWidget {
  const MainAppWindow({super.key});

  @override
  State<MainAppWindow> createState() => _MainAppWindowState();
}

class _MainAppWindowState extends State<MainAppWindow> with TrayListener {
  bool _isPopoverVisible = false;
  
  final _urlController = TextEditingController();
  final _tokenController = TextEditingController();
  final _localPortController = TextEditingController();
  final _localTokenController = TextEditingController();
  bool _obscureLocalToken = true;
  bool _isConnected = false;

  static const _mediaKeyChannel = MethodChannel('sonos_companion/media_keys');

  @override
  void initState() {
    super.initState();
    _initSystemTray();
    _loadConfig();
    _checkConnectionStatus();
    
    // Listen for native macOS media keys
    _mediaKeyChannel.setMethodCallHandler((call) async {
      final config = await AppConfig.loadConfig();
      final pinnedSpeaker = config?['pinnedSpeaker'] as String?;
      if (pinnedSpeaker != null && pinnedSpeaker.isNotEmpty) {
        if (call.method == 'media_play_pause') {
          haWebSocket.callService('media_player', 'media_play_pause', {'entity_id': pinnedSpeaker});
        } else if (call.method == 'media_next_track') {
          haWebSocket.callService('media_player', 'media_next_track', {'entity_id': pinnedSpeaker});
        } else if (call.method == 'media_previous_track') {
          haWebSocket.callService('media_player', 'media_previous_track', {'entity_id': pinnedSpeaker});
        }
      }
    });
  }
  
  Future<void> _loadConfig() async {
    final config = await AppConfig.loadConfig();
    setState(() {
      _urlController.text = config?['haUrl'] as String? ?? '';
      _tokenController.text = config?['haToken'] as String? ?? '';
      _localPortController.text = (config?['localPort'] ?? 9123).toString();
      _localTokenController.text = config?['localToken'] as String? ?? '';
    });
  }

  void _checkConnectionStatus() {
    // Periodically check if WebSocket is connected
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          // A bit hacky, but we check if we have received any states
          _isConnected = haWebSocket.rawStatesCache.isNotEmpty;
        });
        _checkConnectionStatus();
      }
    });
  }

  Future<void> _initSystemTray() async {
    await trayManager.setIcon('assets/app_iconTemplate.png');
    trayManager.addListener(this);
    
    // Listen for commands from the Popover Window
    WindowController.fromWindowId('0').setWindowMethodHandler((call) async {
      if (call.method == 'notification_closed') {
        _notificationWindowId = null;
        return;
      }
      if (call.method == 'set_pinned_speaker') {
        final entityId = call.arguments['entity_id'] as String;
        await AppConfig.savePinnedSpeaker(entityId);
        // Force a UI refresh by sending the new state down
        if (_popoverWindow != null) {
          final currentConfig = await AppConfig.loadConfig();
          await _popoverWindow!.invokeMethod('update_state', {
            'track': haWebSocket.rawStatesCache.isNotEmpty ? globalServer.trackHistory.firstOrNull : null,
            'history': globalServer.trackHistory,
            'speakers': haWebSocket.availableSpeakers,
            'pinnedSpeaker': currentConfig?['pinnedSpeaker'],
          });
        }
        return;
      }
      if (call.method == 'show_main_window') {
        await windowManager.show();
        await windowManager.focus();
        const MethodChannel('sonos_companion/platform').invokeMethod('activate_app');
        return;
      }
      if (call.method == 'quit_app') {
        exit(0);
        return;
      }
      if (call.method == 'playback_action') {
        final args = call.arguments as Map;
        final action = args['action'] as String;
        final entityId = args['entity_id'] as String;
        
        if (action == 'play_pause') {
          haWebSocket.callService('media_player', 'media_play_pause', {'entity_id': entityId});
        } else if (action == 'next') {
          haWebSocket.callService('media_player', 'media_next_track', {'entity_id': entityId});
        } else if (action == 'previous') {
          haWebSocket.callService('media_player', 'media_previous_track', {'entity_id': entityId});
        } else if (action == 'volume_up') {
          haWebSocket.callService('media_player', 'volume_up', {'entity_id': entityId});
        } else if (action == 'volume_down') {
          haWebSocket.callService('media_player', 'volume_down', {'entity_id': entityId});
        } else if (action == 'set_volume') {
          final level = args['volume_level'];
          if (level != null) {
            haWebSocket.callService('media_player', 'volume_set', {
              'entity_id': entityId,
              'volume_level': level,
            });
          }
        } else if (action == 'play_media') {
          final mediaContentType = args['media_content_type'];
          final mediaContentId = args['media_content_id'];
          if (mediaContentType != null && mediaContentId != null) {
            haWebSocket.callService('media_player', 'play_media', {
              'entity_id': entityId,
              'media_content_type': mediaContentType,
              'media_content_id': mediaContentId,
            });
          }
        }
      }
    });
  }

  @override
  void onTrayIconMouseDown() async {
    final trayBounds = await trayManager.getBounds();
    final trayX = trayBounds?.left ?? 0;
    final trayY = trayBounds?.bottom ?? 0;
    final trayCenter = trayX + ((trayBounds?.width ?? 0) / 2);

    if (_popoverWindow == null) {
      _popoverWindow = await WindowController.create(WindowConfiguration(arguments: jsonEncode({'type': 'popover'})));
    }

    if (_isPopoverVisible) {
      await _popoverWindow!.hide();
      _isPopoverVisible = false;
    } else {
      await _popoverWindow!.invokeMethod('align_to_tray', {
        'tray_center_x': trayCenter,
        'tray_bottom_y': trayY,
      });
      // Send the most recent track data to populate the popover immediately
      if (globalServer.trackHistory.isNotEmpty) {
              final currentConfig = await AppConfig.loadConfig();
      await _popoverWindow!.invokeMethod('update_state', {
         'track': globalServer.trackHistory.isNotEmpty ? globalServer.trackHistory.first : null,
         'history': globalServer.trackHistory,
         'speakers': haWebSocket.availableSpeakers,
         'favourites': haWebSocket.nestedFavouritesCache[currentConfig?['pinnedSpeaker'] ?? ''] ?? [],
         'pinnedSpeaker': currentConfig?['pinnedSpeaker'],
      });

      }
      await _popoverWindow!.show();
      _isPopoverVisible = true;
    }
  }

  @override
  void dispose() {
    trayManager.removeListener(this);
    _urlController.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: DefaultTabController(
        length: 2,
        child: Scaffold(
          appBar: AppBar(
            title: const Text('Sonos Desktop Settings'),
            elevation: 0,
            bottom: const TabBar(
              tabs: [
                Tab(text: 'Connection & API'),
                Tab(text: 'Testing & Debug'),
              ],
            ),
          ),
          body: TabBarView(
            children: [
              // TAB 1: General & API
              SingleChildScrollView(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: _isConnected ? Colors.green : Colors.red,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _isConnected ? 'Connected to Home Assistant' : 'Disconnected',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),
                    const Text('Home Assistant WebSocket URL', style: TextStyle(color: Colors.white70)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _urlController,
                      decoration: const InputDecoration(
                        hintText: 'ws://homeassistant.local:8123/api/websocket',
                        border: OutlineInputBorder(),
                        filled: true,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text('Long-Lived Access Token', style: TextStyle(color: Colors.white70)),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _tokenController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        hintText: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...',
                        border: OutlineInputBorder(),
                        filled: true,
                      ),
                    ),
                    const SizedBox(height: 32),
                    const Text('Local Desktop API (For Raycast Extension)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 8),
                    const Text('Configure your Raycast Extension preferences with these credentials to allow it to communicate with the Desktop App.', style: TextStyle(color: Colors.white70)),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          flex: 1,
                          child: TextFormField(
                            controller: _localPortController,
                            decoration: const InputDecoration(labelText: 'Local Port', border: OutlineInputBorder()),
                            readOnly: true,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          flex: 3,
                          child: TextFormField(
                            controller: _localTokenController,
                            obscureText: _obscureLocalToken,
                            decoration: InputDecoration(
                              labelText: 'Secret API Token',
                              border: const OutlineInputBorder(),
                              suffixIcon: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: Icon(_obscureLocalToken ? Icons.visibility : Icons.visibility_off),
                                    onPressed: () => setState(() => _obscureLocalToken = !_obscureLocalToken),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.refresh),
                                    tooltip: 'Regenerate Token',
                                    onPressed: () async {
                                      final newToken = const Uuid().v4();
                                      setState(() {
                                        _localTokenController.text = newToken;
                                        if (_localPortController.text.isEmpty) {
                                          _localPortController.text = '9123';
                                        }
                                        _obscureLocalToken = false;
                                      });
                                      await AppConfig.saveLocalAuth(int.tryParse(_localPortController.text) ?? 9123, newToken);
                                      if (context.mounted) {
                                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Token regenerated!')));
                                      }
                                    },
                                  ),
                                ],
                              ),
                            ),
                            readOnly: true,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),
                    Align(
                      alignment: Alignment.centerRight,
                      child: ElevatedButton(
                        onPressed: () async {
                          await AppConfig.saveConfig(_urlController.text, _tokenController.text);
                          haWebSocket.connect(_urlController.text, _tokenController.text);
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Configuration saved! Reconnecting...')),
                            );
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                        ),
                        child: const Text('Save & Connect', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
              
              // TAB 2: Testing
              Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Notification Tester', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 8),
                    const Text('Trigger a dummy track change notification to test the UI layout and sizing.', style: TextStyle(color: Colors.white70)),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () async {
                        if (_notificationWindowId != null) {
                          try {
                            await WindowController.fromWindowId(_notificationWindowId!).invokeMethod('update_track', {
                              'track': 'Test Track ${DateTime.now().second}',
                              'artist': 'Test Artist',
                              'speaker': 'Test Speaker',
                            });
                          } catch (_) {}
                        } else {
                          final window = await WindowController.create(WindowConfiguration(arguments: jsonEncode({
                            'type': 'notification',
                            'track': 'Test Track',
                            'artist': 'Test Artist',
                            'speaker': 'Test Speaker',
                          })));
                          _notificationWindowId = window.windowId.toString();
                          window.show();
                        }
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.grey.shade800),
                      child: const Text('Test Notification'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
