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
    await windowManager.hide();
  });

  // Init HA WebSocket
  haWebSocket = HAWebSocket(onTrackChange: (trackData) {
    globalServer.triggerNotifyLocally(trackData);
  });

  // Start the background server
  globalServer = LocalServer(onConfigUpdate: (haUrl, haToken) async {
    print('Received HA config from Raycast. Saving and connecting...');
    await AppConfig.saveConfig(haUrl, haToken);
    haWebSocket.connect(haUrl, haToken);
  });
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
    title: "Sonos",
    iconPath: Platform.isWindows ? 'assets/app_icon.ico' : 'assets/app_icon.png',
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
  }

  // Restore saved alignment
  final savedAlignment = savedConfig?['alignment'] as String? ?? 'Top Right';
  await updateAlignment(savedAlignment);

  final Menu menu = Menu();
  await menu.buildFrom([
    MenuItemLabel(label: 'Sonos Companion Running', enabled: false),
    MenuSeparator(),
    SubMenu(
      label: 'Notification Position',
      children: [
        MenuItemLabel(label: 'Top Right', onClicked: (_) => updateAlignment('Top Right')),
        MenuItemLabel(label: 'Top Left', onClicked: (_) => updateAlignment('Top Left')),
        MenuItemLabel(label: 'Top Center', onClicked: (_) => updateAlignment('Top Center')),
        MenuItemLabel(label: 'Bottom Right', onClicked: (_) => updateAlignment('Bottom Right')),
        MenuItemLabel(label: 'Bottom Left', onClicked: (_) => updateAlignment('Bottom Left')),
        MenuItemLabel(label: 'Bottom Center', onClicked: (_) => updateAlignment('Bottom Center')),
      ],
    ),
    MenuSeparator(),
    MenuItemLabel(label: 'Quit', onClicked: (menuItem) async {
      await globalServer.stop();
      haWebSocket.dispose();
      exit(0);
    }),
  ]);
  await systemTray.setContextMenu(menu);

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
            return NotificationPopup(
              notificationStream: globalServer.onNotify,
              alignment: alignment,
            );
          },
        ),
      ),
    );
  }
}
