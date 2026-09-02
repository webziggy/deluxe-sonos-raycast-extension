import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    var windowFrame = self.frame
    // Spawn off-screen to prevent the brief black flash on launch!
    windowFrame.origin = NSPoint(x: -10000, y: -10000)
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)
    
    // Force transparency for borderless popup
    self.isOpaque = false
    self.backgroundColor = NSColor.clear
    self.styleMask.insert(.fullSizeContentView)
    self.styleMask.insert(.borderless)
    
    // Ensure the Flutter view itself has a clear background
    flutterViewController.backgroundColor = NSColor.clear

    RegisterGeneratedPlugins(registry: flutterViewController)

    super.awakeFromNib()
  }
}
