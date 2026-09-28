import Cocoa
import FlutterMacOS
import MediaPlayer

@main
class AppDelegate: FlutterAppDelegate {
  
  var methodChannel: FlutterMethodChannel?

  override func applicationDidFinishLaunching(_ notification: Notification) {
    if let flutterViewController = NSApplication.shared.windows.first?.contentViewController as? FlutterViewController {
      methodChannel = FlutterMethodChannel(name: "sonos_companion/media_keys", binaryMessenger: flutterViewController.engine.binaryMessenger)
    }
    setupMediaKeys()
    super.applicationDidFinishLaunching(notification)
  }

  override func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    return false
  }

  override func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
    return true
  }
  
  private func setupMediaKeys() {
    let commandCenter = MPRemoteCommandCenter.shared()
    
    // Play/Pause
    commandCenter.togglePlayPauseCommand.isEnabled = true
    commandCenter.togglePlayPauseCommand.addTarget { [weak self] event in
      self?.methodChannel?.invokeMethod("media_play_pause", arguments: nil)
      return .success
    }
    
    // Play
    commandCenter.playCommand.isEnabled = true
    commandCenter.playCommand.addTarget { [weak self] event in
      self?.methodChannel?.invokeMethod("media_play_pause", arguments: nil)
      return .success
    }
    
    // Pause
    commandCenter.pauseCommand.isEnabled = true
    commandCenter.pauseCommand.addTarget { [weak self] event in
      self?.methodChannel?.invokeMethod("media_play_pause", arguments: nil)
      return .success
    }
    
    // Next
    commandCenter.nextTrackCommand.isEnabled = true
    commandCenter.nextTrackCommand.addTarget { [weak self] event in
      self?.methodChannel?.invokeMethod("media_next_track", arguments: nil)
      return .success
    }
    
    // Previous
    commandCenter.previousTrackCommand.isEnabled = true
    commandCenter.previousTrackCommand.addTarget { [weak self] event in
      self?.methodChannel?.invokeMethod("media_previous_track", arguments: nil)
      return .success
    }
  }
}
