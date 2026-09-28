import 'dart:ui';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:desktop_multi_window/desktop_multi_window.dart';
import 'package:window_manager/window_manager.dart';

class PopoverSubWindow extends StatefulWidget {
  final String windowId;
  final Map<String, dynamic> argument;

  const PopoverSubWindow({super.key, required this.windowId, required this.argument});

  @override
  State<PopoverSubWindow> createState() => _PopoverSubWindowState();
}

class _PopoverSubWindowState extends State<PopoverSubWindow> {
  static const double popoverWidth = 320.0;
  static const double popoverHeight = 480.0;
  
  Map<String, dynamic>? _currentState;
  bool _showFavourites = false; // Toggle between history and favourites
  double _volumeLevel = 0.5;

  @override
  void initState() {
    super.initState();
    _initWindow();
    
    WindowController.fromWindowId(widget.windowId).setWindowMethodHandler((call) async {
      if (call.method == 'align_to_tray') {
        final args = call.arguments as Map;
        final trayCenterX = (args['tray_center_x'] as num).toDouble();
        final trayBottomY = (args['tray_bottom_y'] as num).toDouble();
        
        final x = trayCenterX - (popoverWidth / 2);
        final y = trayBottomY + 5;
        
        await windowManager.setPosition(Offset(x, y));
      } else if (call.method == 'update_state') {
        setState(() {
          _currentState = Map<String, dynamic>.from(call.arguments as Map);
        });
      }
    });
  }

  Future<void> _initWindow() async {
    await windowManager.setTitle('Sonos Popover');
    await windowManager.setSize(const Size(popoverWidth, popoverHeight));
    await windowManager.setAsFrameless();
    await windowManager.setHasShadow(false);
  }

  @override
  Widget build(BuildContext context) {
    final trackData = _currentState?['track'] as Map?;
    final trackName = trackData?['track'] ?? 'Not Playing';
    final artistName = trackData?['artist'] ?? '';
    final entityId = trackData?['entityId'] as String? ?? '';
    final state = trackData?['state'] as String? ?? 'paused';
    final isPlaying = state == 'playing';
    final artUrl = trackData?['artUrl'] as String?;
    final haToken = trackData?['haToken'] as String?;
    
    final pinnedSpeaker = _currentState?['pinnedSpeaker'] as String? ?? '';
    final speakers = List<Map>.from(_currentState?['speakers'] ?? []);
    final history = List<Map>.from(_currentState?['history'] ?? []);
    final favourites = List<Map>.from(_currentState?['favourites'] ?? []);

    final badgeUrl = trackData?['badgeUrl'] as String?;
    Widget artworkWidget = const Icon(Icons.music_note, size: 32, color: Colors.white54);
    if (artUrl != null && artUrl.isNotEmpty) {
      if (artUrl.startsWith('data:image')) {
        final base64String = artUrl.split(',').last;
        artworkWidget = Image.memory(base64Decode(base64String), fit: BoxFit.cover);
      } else {
        artworkWidget = Image.network(
          artUrl,
          headers: haToken != null && !artUrl.contains('mzstatic.com') ? {'Authorization': 'Bearer $haToken'} : null,
          fit: BoxFit.cover,
          errorBuilder: (c, e, s) => const Icon(Icons.error, size: 32, color: Colors.white54),
        );
      }
    }
    
    // Gap 4: Defensive Artwork Compositing (Service Badge overlays)
    if (badgeUrl != null && badgeUrl.isNotEmpty) {
      artworkWidget = Stack(
        fit: StackFit.expand,
        children: [
          artworkWidget,
          Positioned(
            bottom: 2,
            right: 2,
            child: Container(
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.black,
                border: Border.all(color: Colors.white.withOpacity(0.5), width: 1),
                image: DecorationImage(
                  image: NetworkImage(badgeUrl, headers: haToken != null ? {'Authorization': 'Bearer $haToken'} : null),
                  fit: BoxFit.cover,
                ),
              ),
            ),
          ),
        ],
      );
    }

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: Scaffold(
        backgroundColor: Colors.transparent,
        body: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              width: popoverWidth,
              height: popoverHeight,
              decoration: BoxDecoration(
                color: const Color(0xFF1E1E1E).withOpacity(0.65), // Glassmorphism base
                border: Border.all(color: Colors.white.withOpacity(0.15), width: 1),
              ),
              child: Column(
                children: [
                  // 1. Header Row (Album Art & Details)
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: Container(
                            width: 56,
                            height: 56,
                            color: Colors.black45,
                            child: artworkWidget,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                trackName,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (artistName.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  artistName,
                                  style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.7)),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ],
                          ),
                        ),
                        // Play/Pause button in header
                        IconButton(
                          icon: Icon(isPlaying ? Icons.pause_circle_filled : Icons.play_circle_fill),
                          iconSize: 36,
                          color: Colors.white,
                          onPressed: entityId.isEmpty ? null : () {
                            WindowController.fromWindowId('0').invokeMethod('playback_action', {'action': 'play_pause', 'entity_id': entityId});
                          },
                        ),
                      ],
                    ),
                  ),
                  
                  // 2. Speaker Selector & Volume Row
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    child: Row(
                      children: [
                        const Icon(Icons.speaker_group, size: 16, color: Colors.white54),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              isExpanded: true,
                              value: speakers.any((s) => s['id'] == pinnedSpeaker) ? pinnedSpeaker : (speakers.isNotEmpty ? speakers.first['id'] : null),
                              hint: const Text('Select Speaker', style: TextStyle(fontSize: 12)),
                              style: const TextStyle(fontSize: 12, color: Colors.white),
                              dropdownColor: Colors.grey.shade900,
                              onChanged: (String? newValue) {
                                if (newValue != null) {
                                  WindowController.fromWindowId('0').invokeMethod('set_pinned_speaker', {'entity_id': newValue});
                                }
                              },
                              items: speakers.map<DropdownMenuItem<String>>((Map speaker) {
                                return DropdownMenuItem<String>(
                                  value: speaker['id'] as String,
                                  child: Text(speaker['name'] as String, overflow: TextOverflow.ellipsis),
                                );
                              }).toList(),
                            ),
                          ),
                        ),
                        // Volume Slider
                        SizedBox(
                          width: 120,
                          child: SliderTheme(
                            data: SliderThemeData(
                              trackHeight: 4,
                              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                              overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                            ),
                            child: Slider(
                              value: _volumeLevel,
                              onChanged: (val) => setState(() => _volumeLevel = val),
                              onChangeEnd: (val) {
                                if (entityId.isNotEmpty) {
                                  WindowController.fromWindowId('0').invokeMethod('playback_action', {
                                    'action': 'set_volume', 
                                    'entity_id': entityId,
                                    'volume_level': val,
                                  });
                                }
                              },
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  Divider(color: Colors.white.withOpacity(0.1), height: 1),
                  
                  // 3. Tab Toggle (History vs Favourites)
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _showFavourites = false),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            color: !_showFavourites ? Colors.white.withOpacity(0.1) : Colors.transparent,
                            alignment: Alignment.center,
                            child: const Text('Recent', style: TextStyle(fontSize: 12)),
                          ),
                        ),
                      ),
                      Expanded(
                        child: InkWell(
                          onTap: () => setState(() => _showFavourites = true),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            color: _showFavourites ? Colors.white.withOpacity(0.1) : Colors.transparent,
                            alignment: Alignment.center,
                            child: const Text('Favourites', style: TextStyle(fontSize: 12)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  
                  // 4. Expanded List
                  Expanded(
                    child: _showFavourites
                      ? (favourites.isEmpty 
                          ? const Center(child: Text('No Favourites found', style: TextStyle(color: Colors.white54, fontSize: 12)))
                          : ListView(
                              padding: EdgeInsets.zero,
                              children: favourites.map((section) {
                                final title = section['title'] as String;
                                final items = List<Map>.from(section['items'] ?? []);
                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                      child: Text(title.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white54)),
                                    ),
                                    ...items.map((item) {
                                      final itemName = item['title'] as String;
                                      return ListTile(
                                        leading: const Icon(Icons.star, size: 16, color: Colors.amber),
                                        title: Text(itemName, style: const TextStyle(fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
                                        dense: true,
                                        visualDensity: VisualDensity.compact,
                                        onTap: () {
                                          if (pinnedSpeaker.isNotEmpty) {
                                            WindowController.fromWindowId('0').invokeMethod('playback_action', {
                                              'action': 'play_media', 
                                              'entity_id': pinnedSpeaker,
                                              'media_content_type': item['media_content_type'],
                                              'media_content_id': item['media_content_id'],
                                            });
                                          }
                                        },
                                      );
                                    }).toList(),
                                  ],
                                );
                              }).toList(),
                            ))
                      : ListView.builder(
                          padding: EdgeInsets.zero,
                          itemCount: history.length,
                          itemBuilder: (context, index) {
                            final hTrack = history[index];
                            return ListTile(
                              leading: const Icon(Icons.history, size: 16, color: Colors.white38),
                              title: Text(hTrack['track'] ?? 'Unknown', style: const TextStyle(fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
                              subtitle: Text(hTrack['speaker'] ?? '', style: TextStyle(fontSize: 10, color: Colors.white54)),
                              dense: true,
                              visualDensity: VisualDensity.compact,
                            );
                          },
                        ),
                  ),
                  
                  Divider(color: Colors.white.withOpacity(0.1), height: 1),
                  
                  // 5. Footer Actions
                  Container(
                    color: Colors.black12,
                    child: Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => WindowController.fromWindowId('0').invokeMethod('show_main_window'),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(vertical: 12.0),
                              child: Center(child: Text('Settings', style: TextStyle(fontSize: 12))),
                            ),
                          ),
                        ),
                        Container(width: 1, height: 24, color: Colors.white.withOpacity(0.1)),
                        Expanded(
                          child: InkWell(
                            onTap: () => WindowController.fromWindowId('0').invokeMethod('quit_app'),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(vertical: 12.0),
                              child: Center(child: Text('Quit App', style: TextStyle(fontSize: 12))),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
