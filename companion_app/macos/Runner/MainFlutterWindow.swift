import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    var windowFrame = self.frame
    // Spawn WAY off-screen to prevent the brief black flash on launch!
    // We use a huge number so it doesn't accidentally hit a secondary monitor
    windowFrame.origin = NSPoint(x: 1000000, y: 1000000)
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

    // Never steal mouse clicks
    self.ignoresMouseEvents = true

    super.awakeFromNib()
  }

  override var canBecomeKey: Bool {
    return false
  }

  override var canBecomeMain: Bool {
    return false
  }
}
