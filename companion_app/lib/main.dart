import 'package:flutter/material.dart';
import 'package:system_tray/system_tray.dart';
import 'package:window_manager/window_manager.dart';
import 'dart:io';

import 'server.dart';
import 'popup.dart';

late LocalServer globalServer;

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Hide the default window on launch (so it runs purely in the background)
  await windowManager.ensureInitialized();
  WindowOptions windowOptions = WindowOptions(
    size: Size(350, 130),
    center: false,
    backgroundColor: Colors.transparent,
    skipTaskbar: true,
    titleBarStyle: TitleBarStyle.hidden,
    alwaysOnTop: true,
  );
  
  await windowManager.waitUntilReadyToShow(windowOptions, () async {
    // Position it at the top right, similar to macOS notifications
    // Note: To get precise display bounds we'd use screen_retriever, but top right with a hardcoded offset works for now.
    await windowManager.setAlignment(Alignment.topRight);
    await windowManager.hide();
  });

  // Start the background server
  globalServer = LocalServer();
  await globalServer.start();

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
