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

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

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
    // Pipe the WebSocket event into the local server's stream so the UI picks it up
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

  final Menu menu = Menu();
  await menu.buildFrom([
    MenuItemLabel(label: 'Sonos Companion Running', enabled: false),
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
        body: NotificationPopup(notificationStream: globalServer.onNotify),
      ),
    );
  }
}
