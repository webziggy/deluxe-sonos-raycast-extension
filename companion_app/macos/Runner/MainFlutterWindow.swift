import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    // Hide the window natively immediately before display to prevent the flash
    self.isReleasedWhenClosed = false
    self.orderOut(nil)
    self.setFrame(windowFrame, display: false)
    
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
