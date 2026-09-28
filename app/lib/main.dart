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

    await windowManager.ensureInitialized();

    if (windowType == 'notification') {
      runApp(NotificationSubWindow(windowId: windowId, argument: argument));
    } else if (windowType == 'popover') {
      runApp(PopoverSubWindow(windowId: windowId, argument: argument));
    }
  } else {
    // 0. Load Configuration
    final config = await AppConfig.loadConfig();
    
    // 1. Initialize HA WebSocket and local server in the MAIN window
    haWebSocket = HAWebSocket(onTrackChange: (trackData, isInitialSync) async {
      final trackName = trackData['track'] ?? 'Unknown Track';
      final speakerName = trackData['speaker'] ?? 'Unknown Speaker';
      
      // Update the local history array (for the Raycast HTTP API)
      globalServer.trackHistory.insert(0, trackData);
      if (globalServer.trackHistory.length > 10) {
        globalServer.trackHistory.removeLast();
      }

      // If the Popover window exists, send the new track data via IPC
      if (_popoverWindow != null) {
        await _popoverWindow!.invokeMethod('update_track', trackData);
      }

      // TODO: Spawn notification window if isInitialSync == false
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

  @override
  void initState() {
    super.initState();
    _initSystemTray();
    _loadConfig();
    _checkConnectionStatus();
  }
  
  Future<void> _loadConfig() async {
    final config = await AppConfig.loadConfig();
    setState(() {
      _urlController.text = config?['haUrl'] as String? ?? '';
      _tokenController.text = config?['haToken'] as String? ?? '';
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
        await _popoverWindow!.invokeMethod('update_track', globalServer.trackHistory.first);
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
      home: Scaffold(
        appBar: AppBar(
          title: const Text('Sonos Desktop Settings'),
          elevation: 0,
        ),
        body: Padding(
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  ElevatedButton(
                    onPressed: () async {
                      final window = await WindowController.create(WindowConfiguration(arguments: jsonEncode({'type': 'notification'})));
                      window.show();
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.grey.shade800),
                    child: const Text('Test Notification'),
                  ),
                  ElevatedButton(
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
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class NotificationSubWindow extends StatefulWidget {
  final String windowId;
  final Map<String, dynamic> argument;

  const NotificationSubWindow({super.key, required this.windowId, required this.argument});

  @override
  State<NotificationSubWindow> createState() => _NotificationSubWindowState();
}

class _NotificationSubWindowState extends State<NotificationSubWindow> {
  @override
  void initState() {
    super.initState();
    _initWindow();
  }

  Future<void> _initWindow() async {
    await windowManager.setTitle('Sonos Notification');
    await windowManager.setSize(const Size(350, 130));
    await windowManager.setAlignment(Alignment.topRight);
    await windowManager.setAsFrameless();
    await windowManager.setHasShadow(false);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: Colors.transparent,
        body: Center(
          child: Container(
            width: 350,
            height: 130,
            color: Colors.red.withOpacity(0.5),
            child: const Center(child: Text('Notification Window', style: TextStyle(color: Colors.white))),
          ),
        ),
      ),
    );
  }
}

class PopoverSubWindow extends StatefulWidget {
  final String windowId;
  final Map<String, dynamic> argument;

  const PopoverSubWindow({super.key, required this.windowId, required this.argument});

  @override
  State<PopoverSubWindow> createState() => _PopoverSubWindowState();
}

class _PopoverSubWindowState extends State<PopoverSubWindow> {
  static const double popoverWidth = 320.0;
  static const double popoverHeight = 450.0;
  
  Map<String, dynamic>? _currentTrack;

  @override
  void initState() {
    super.initState();
    _initWindow();
    
    WindowController.fromWindowId(widget.windowId).setWindowMethodHandler((call) async {
      if (call.method == 'align_to_tray') {
        final args = call.arguments as Map;
        final trayCenterX = (args['tray_center_x'] as num).toDouble();
        final trayBottomY = (args['tray_bottom_y'] as num).toDouble();
        
        final x = trayCenterX - (popoverWidth / 2);
        final y = trayBottomY + 5;
        
        await windowManager.setPosition(Offset(x, y));
      } else if (call.method == 'update_track') {
        setState(() {
          _currentTrack = Map<String, dynamic>.from(call.arguments as Map);
        });
      }
    });
  }

  Future<void> _initWindow() async {
    await windowManager.setTitle('Sonos Popover');
    await windowManager.setSize(const Size(popoverWidth, popoverHeight));
    await windowManager.setAsFrameless();
    await windowManager.setHasShadow(false);
  }

  @override
  Widget build(BuildContext context) {
    final trackName = _currentTrack?['track'] ?? 'Not Playing';
    final artistName = _currentTrack?['artist'] ?? '';
        final speakerName = _currentTrack?['speaker'] ?? 'No Speaker Selected';
    final entityId = _currentTrack?['entityId'] as String? ?? '';
    final state = _currentTrack?['state'] as String? ?? 'paused';
    final isPlaying = state == 'playing';
  
    final artUrl = _currentTrack?['artUrl'] as String?;
    
    Widget artworkWidget = const Center(child: Icon(Icons.music_note, size: 64, color: Colors.white54));
    
    if (artUrl != null && artUrl.isNotEmpty) {
      if (artUrl.startsWith('data:image')) {
        final base64String = artUrl.split(',').last;
        artworkWidget = Image.memory(
          base64Decode(base64String),
          width: 280,
          height: 280,
          fit: BoxFit.cover,
        );
      } else {
        artworkWidget = Image.network(
          artUrl,
          width: 280,
          height: 280,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => const Center(child: Icon(Icons.error, size: 64, color: Colors.white54)),
        );
      }
    }

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: Scaffold(
        backgroundColor: Colors.transparent,
        body: Container(
          width: popoverWidth,
          height: popoverHeight,
          decoration: BoxDecoration(
            color: const Color(0xFF1E1E1E).withOpacity(0.95),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withOpacity(0.1), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.5),
                blurRadius: 20,
                offset: const Offset(0, 10),
              )
            ],
          ),
          child: Column(
            children: [
              const SizedBox(height: 20),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  width: 280,
                  height: 280,
                  color: Colors.black26,
                  child: artworkWidget,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                trackName, 
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (artistName.isNotEmpty) 
                Text(
                  artistName, 
                  style: const TextStyle(fontSize: 14, color: Colors.white70),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              Text(
                speakerName, 
                style: const TextStyle(fontSize: 12, color: Colors.white54),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.volume_down), 
                    onPressed: entityId.isEmpty ? null : () => WindowController.fromWindowId('0').invokeMethod('playback_action', {'action': 'volume_down', 'entity_id': entityId}),
                  ),
                  const SizedBox(width: 16),
                  IconButton(
                    icon: const Icon(Icons.skip_previous), 
                    onPressed: entityId.isEmpty ? null : () => WindowController.fromWindowId('0').invokeMethod('playback_action', {'action': 'previous', 'entity_id': entityId}),
                  ),
                  IconButton(
                    icon: Icon(isPlaying ? Icons.pause : Icons.play_arrow, size: 36), 
                    onPressed: entityId.isEmpty ? null : () => WindowController.fromWindowId('0').invokeMethod('playback_action', {'action': 'play_pause', 'entity_id': entityId}),
                  ),
                  IconButton(
                    icon: const Icon(Icons.skip_next), 
                    onPressed: entityId.isEmpty ? null : () => WindowController.fromWindowId('0').invokeMethod('playback_action', {'action': 'next', 'entity_id': entityId}),
                  ),
                  const SizedBox(width: 16),
                  IconButton(
                    icon: const Icon(Icons.volume_up), 
                    onPressed: entityId.isEmpty ? null : () => WindowController.fromWindowId('0').invokeMethod('playback_action', {'action': 'volume_up', 'entity_id': entityId}),
                  ),
                ],
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
