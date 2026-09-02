import 'package:flutter/material.dart';
import 'package:system_tray/system_tray.dart';
import 'package:window_manager/window_manager.dart';
import 'dart:io';

import 'server.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Hide the default window on launch (so it runs purely in the background)
  await windowManager.ensureInitialized();
  WindowOptions windowOptions = WindowOptions(
    size: Size(400, 150),
    center: true,
    backgroundColor: Colors.transparent,
    skipTaskbar: true,
    titleBarStyle: TitleBarStyle.hidden,
  );
  
  await windowManager.waitUntilReadyToShow(windowOptions, () async {
    await windowManager.hide();
  });

  // Start the background server
  final server = LocalServer();
  await server.start();

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
      await server.stop();
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
        // Make scaffold transparent for our custom popup
        scaffoldBackgroundColor: Colors.transparent, 
      ),
      home: const Placeholder(), // We will build the visual popup later
    );
  }
}
