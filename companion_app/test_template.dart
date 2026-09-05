import 'package:system_tray/system_tray.dart';
void main() async {
  final tray = SystemTray();
  await tray.initSystemTray(title: "", iconPath: "test", isTemplate: true);
}
