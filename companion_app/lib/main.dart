import 'package:flutter/material.dart';
import 'package:system_tray/system_tray.dart';
import 'package:window_manager/window_manager.dart';
import 'dart:io';

import 'server.dart';
import 'popup.dart';
import 'ha_websocket.dart';
import 'config.dart';

late LocalServer globalServer;
late HAWebSocket haWebSocket;

class MyHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback = (X509Certificate cert, String host, int port) => true;
  }
}

final ValueNotifier<String> alignmentNotifier = ValueNotifier<String>('Top Right');
final ValueNotifier<String> cardSizeNotifier = ValueNotifier<String>('Small');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  HttpOverrides.global = MyHttpOverrides();

  // Hide the default window on launch
  await windowManager.ensureInitialized();
  WindowOptions windowOptions = const WindowOptions(
    size: Size(350, 130),
    center: false,
    backgroundColor: Colors.transparent,
    skipTaskbar: true,
    titleBarStyle: TitleBarStyle.hidden,
    windowButtonVisibility: false,
    alwaysOnTop: true,
  );
  
  await windowManager.waitUntilReadyToShow(windowOptions, () async {
    await windowManager.setAsFrameless();
    await windowManager.setHasShadow(false);
    await windowManager.setAlignment(Alignment.topRight);
    await windowManager.show();
  });

  Future<void> Function()? rebuildMenuCallback;

  // Init HA WebSocket
  haWebSocket = HAWebSocket(onTrackChange: (trackData, isInitialSync) async {
    final trackName = trackData['track'] ?? 'Unknown Track';
    final speakerName = trackData['speaker'] ?? 'Unknown Speaker';
    final fullString = '$trackName on $speakerName';

    // 1. Maintain History
    globalServer.trackHistory.insert(0, trackData);
    if (globalServer.trackHistory.length > 10) {
      globalServer.trackHistory.removeLast();
    }
    
    // Trigger tray rebuild to show new history (debounced to prevent native crash on boot storm)
    globalServer.cancelRebuildTimer();
    globalServer.startRebuildTimer(rebuildMenuCallback);
    
    if (isInitialSync) return;

    final config = await AppConfig.loadConfig();
    
    if (config?['notificationsEnabled'] == false) {
      return;
    }

    // 2. Regex Filtering
    List<String> allowlist = List<String>.from(config?['allowlist'] ?? []);
    List<String> blocklist = List<String>.from(config?['blocklist'] ?? []);

    bool allowed = true;
    if (allowlist.isNotEmpty) {
      allowed = allowlist.any((r) => RegExp(r, caseSensitive: false).hasMatch(fullString));
    }
    if (allowed && blocklist.isNotEmpty) {
      if (blocklist.any((r) => RegExp(r, caseSensitive: false).hasMatch(fullString))) {
        allowed = false;
      }
    }

    if (allowed) {
      globalServer.triggerNotifyLocally(trackData);
    }
  });

  // Start the background server
  globalServer = LocalServer(onConfigUpdate: (haUrl, haToken) async {
    print('Received HA config from Raycast. Saving and connecting...');
    await AppConfig.saveConfig(haUrl, haToken);
    haWebSocket.connect(haUrl, haToken);
  });
  globalServer.getDebugStates = () => haWebSocket.rawStatesCache;
  await globalServer.start();

  // Load existing config on boot
  final savedConfig = await AppConfig.loadConfig();
  if (savedConfig != null) {
    print('Found saved HA config. Connecting...');
    haWebSocket.connect(savedConfig['haUrl'], savedConfig['haToken']);
  }

  // Initialize System Tray
  final SystemTray systemTray = SystemTray();
  await systemTray.initSystemTray(
    title: "",
    iconPath: Platform.isWindows ? 'assets/app_icon.ico' : 'assets/app_iconTemplate.png',
  );

  Future<void> updateAlignment(String alignment) async {
    await AppConfig.saveAlignment(alignment);
    alignmentNotifier.value = alignment;
    Alignment uiAlign = Alignment.topRight;
    switch (alignment) {
      case 'Top Right': uiAlign = Alignment.topRight; break;
      case 'Top Left': uiAlign = Alignment.topLeft; break;
      case 'Top Center': uiAlign = Alignment.topCenter; break;
      case 'Bottom Right': uiAlign = Alignment.bottomRight; break;
      case 'Bottom Left': uiAlign = Alignment.bottomLeft; break;
      case 'Bottom Center': uiAlign = Alignment.bottomCenter; break;
    }
    await windowManager.setAlignment(uiAlign);
    
    // Show a preview notification
    globalServer.triggerNotifyLocally({
      'track': 'Position Preview: $alignment',
      'speaker': 'Sonos System',
      'artUrl': null,
      'haToken': null,
    });
  }

  Future<void> updateCardSize(String size) async {
    await AppConfig.saveCardSize(size);
    cardSizeNotifier.value = size;
    Size uiSize = const Size(350, 130);
    switch (size) {
      case 'Small': uiSize = const Size(350, 130); break;
      case 'Medium': uiSize = const Size(450, 160); break;
      case 'Large': uiSize = const Size(600, 210); break;
    }
    await windowManager.setSize(uiSize);
    
    // Re-apply alignment so the window shifts correctly based on new size
    final currentAlignment = alignmentNotifier.value;
    Alignment uiAlign = Alignment.topRight;
    switch (currentAlignment) {
      case 'Top Right': uiAlign = Alignment.topRight; break;
      case 'Top Left': uiAlign = Alignment.topLeft; break;
      case 'Top Center': uiAlign = Alignment.topCenter; break;
      case 'Bottom Right': uiAlign = Alignment.bottomRight; break;
      case 'Bottom Left': uiAlign = Alignment.bottomLeft; break;
      case 'Bottom Center': uiAlign = Alignment.bottomCenter; break;
    }
    await windowManager.setAlignment(uiAlign);
    
    // Show a preview notification
    globalServer.triggerNotifyLocally({
      'track': 'Size Preview: $size',
      'speaker': 'Sonos System',
      'artUrl': null,
      'haToken': null,
    });
  }

  // Restore saved alignment
  final savedAlignment = savedConfig?['alignment'] as String? ?? 'Top Right';
  await updateAlignment(savedAlignment);

  // Restore saved size
  final savedSize = savedConfig?['cardSize'] as String? ?? 'Small';
  await updateCardSize(savedSize);

  final Menu menu = Menu();

  Future<void> rebuildMenu() async {
    final config = await AppConfig.loadConfig();
    final isPaused = config?['notificationsEnabled'] == false;
    
    List<MenuItemBase> menuItems = [
      MenuItemLabel(label: isPaused ? '⏸ Notifications Paused' : '✅ Notifications Active', enabled: false),
      MenuSeparator(),
      MenuItemLabel(
        label: isPaused ? 'Resume Notifications' : 'Pause Notifications',
        onClicked: (_) async {
          await AppConfig.saveNotificationsEnabled(isPaused);
          await rebuildMenu();
        },
      ),
      MenuSeparator(),
    ];

    if (globalServer.trackHistory.isNotEmpty) {
      menuItems.add(MenuItemLabel(label: 'Recent Tracks', enabled: false));
      for (var track in globalServer.trackHistory) {
        final title = track['track'] ?? 'Unknown';
        final speaker = track['speaker'] ?? 'Unknown';
        menuItems.add(MenuItemLabel(
          label: '• $title ($speaker)', 
          onClicked: (_) {
            globalServer.triggerNotifyLocally(track);
          }
        ));
      }
      menuItems.add(MenuSeparator());
    }

    menuItems.addAll([
      MenuItemLabel(label: 'Size: Small', onClicked: (_) => updateCardSize('Small')),
      MenuItemLabel(label: 'Size: Medium', onClicked: (_) => updateCardSize('Medium')),
      MenuItemLabel(label: 'Size: Large', onClicked: (_) => updateCardSize('Large')),
      MenuSeparator(),
      MenuItemLabel(label: 'Position: Top Right', onClicked: (_) => updateAlignment('Top Right')),
      MenuItemLabel(label: 'Position: Top Left', onClicked: (_) => updateAlignment('Top Left')),
      MenuItemLabel(label: 'Position: Top Center', onClicked: (_) => updateAlignment('Top Center')),
      MenuItemLabel(label: 'Position: Bottom Right', onClicked: (_) => updateAlignment('Bottom Right')),
      MenuItemLabel(label: 'Position: Bottom Left', onClicked: (_) => updateAlignment('Bottom Left')),
      MenuItemLabel(label: 'Position: Bottom Center', onClicked: (_) => updateAlignment('Bottom Center')),
      MenuSeparator(),
      MenuItemLabel(label: 'Quit', onClicked: (menuItem) async {
        await globalServer.stop();
        haWebSocket.dispose();
        exit(0);
      }),
    ]);

    await menu.buildFrom(menuItems);
    await systemTray.setContextMenu(menu);
  }

  rebuildMenuCallback = rebuildMenu;
  await rebuildMenu();

  // Handle system tray click events natively
  systemTray.registerSystemTrayEventHandler((eventName) {
    debugPrint("eventName: $eventName");
    if (eventName == kSystemTrayEventClick) {
      systemTray.popUpContextMenu();
    } else if (eventName == kSystemTrayEventRightClick) {
      systemTray.popUpContextMenu();
    }
  });

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sonos Companion',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
        scaffoldBackgroundColor: Colors.transparent, 
      ),
      home: Scaffold(
        body: ValueListenableBuilder<String>(
          valueListenable: alignmentNotifier,
          builder: (context, alignment, child) {
            return ValueListenableBuilder<String>(
              valueListenable: cardSizeNotifier,
              builder: (context, size, child) {
                return NotificationPopup(
                  notificationStream: globalServer.onNotify,
                  alignment: alignment,
                  cardSize: size,
                );
              },
            );
          },
        ),
      ),
    );
  }
}
