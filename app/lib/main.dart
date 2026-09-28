import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:desktop_multi_window/desktop_multi_window.dart';
import 'package:window_manager/window_manager.dart';
import 'package:tray_manager/tray_manager.dart';

Future<void> main(List<String> args) async {
  WidgetsFlutterBinding.ensureInitialized();

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
    runApp(const MainAppWindow());
  }
}

class MainAppWindow extends StatefulWidget {
  const MainAppWindow({super.key});

  @override
  State<MainAppWindow> createState() => _MainAppWindowState();
}

class _MainAppWindowState extends State<MainAppWindow> with TrayListener {
  @override
  void initState() {
    super.initState();
    _initSystemTray();
  }

  Future<void> _initSystemTray() async {
    await trayManager.setIcon('assets/app_iconTemplate.png');
    trayManager.addListener(this);
  }

  WindowController? _popoverWindow;
  bool _isPopoverVisible = false;

  @override
  void onTrayIconMouseDown() async {
    if (_popoverWindow == null) {
      _popoverWindow = await WindowController.create(WindowConfiguration(arguments: jsonEncode({'type': 'popover'})));
      await _popoverWindow!.show();
      _isPopoverVisible = true;
    } else {
      if (_isPopoverVisible) {
        await _popoverWindow!.hide();
        _isPopoverVisible = false;
      } else {
        await _popoverWindow!.show();
        _isPopoverVisible = true;
      }
    }
  }

  @override
  void dispose() {
    trayManager.removeListener(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: const Text('Sonos Settings')),
        body: Center(
          child: ElevatedButton(
            onPressed: () async {
              final window = await WindowController.create(WindowConfiguration(arguments: jsonEncode({'type': 'notification'})));
              window.show();
            },
            child: const Text('Test Spawn Notification Window'),
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
  @override
  void initState() {
    super.initState();
    _initWindow();
  }

  Future<void> _initWindow() async {
    await windowManager.setTitle('Sonos Popover');
    await windowManager.setSize(const Size(300, 400));
    await windowManager.setAlignment(Alignment.center);
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
            width: 300,
            height: 400,
            color: Colors.blue.withOpacity(0.8),
            child: const Center(child: Text('Tray Popover Window', style: TextStyle(color: Colors.white))),
          ),
        ),
      ),
    );
  }
}
