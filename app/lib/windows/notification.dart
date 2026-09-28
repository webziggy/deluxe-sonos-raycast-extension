import 'dart:async';
import 'package:flutter/material.dart';
import 'package:desktop_multi_window/desktop_multi_window.dart';
import 'package:window_manager/window_manager.dart';
import '../popup.dart';

class NotificationSubWindow extends StatefulWidget {
  final String windowId;
  final Map<String, dynamic> argument;

  const NotificationSubWindow({super.key, required this.windowId, required this.argument});

  @override
  State<NotificationSubWindow> createState() => _NotificationSubWindowState();
}

class _NotificationSubWindowState extends State<NotificationSubWindow> {
  final StreamController<Map<String, dynamic>> _notifController = StreamController<Map<String, dynamic>>.broadcast();

  @override
  void initState() {
    super.initState();
    _initWindow();
    
    // Listen for IPC track changes from Main Window
    WindowController.fromWindowId(widget.windowId).setWindowMethodHandler((call) async {
      if (call.method == 'update_track') {
        _notifController.add(Map<String, dynamic>.from(call.arguments));
      } else if (call.method == 'close_notification') {
        await windowManager.close();
      }
    });
  }

  Future<void> _initWindow() async {
    await windowManager.setTitle('Sonos Notification');
    // We size the window to fit a 'Medium' or 'Large' notification popup
    await windowManager.setSize(const Size(450, 180)); 
    await windowManager.setAlignment(Alignment.topRight);
    await windowManager.setAsFrameless();
    await windowManager.setHasShadow(false);
    
    // Inject the initial track immediately
    if (widget.argument.containsKey('track')) {
      Future.delayed(const Duration(milliseconds: 100), () {
        if (mounted) {
          _notifController.add(widget.argument);
        }
      });
    }
  }

  @override
  void dispose() {
    _notifController.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: Colors.transparent,
        body: NotificationPopup(
          notificationStream: _notifController.stream,
          alignment: 'Top Right',
          cardSize: 'Medium',
          fontFamily: 'Default',
          onCloseFinished: () async {
            // Signal main window we are done
            try {
              await WindowController.fromWindowId('0').invokeMethod('notification_closed');
            } catch (_) {}
            await windowManager.close();
          },
        ),
      ),
    );
  }
}
