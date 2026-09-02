import 'dart:async';
import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';

class NotificationPopup extends StatefulWidget {
  final Stream<Map<String, dynamic>> notificationStream;
  final String alignment;

  const NotificationPopup({super.key, required this.notificationStream, required this.alignment});

  @override
  State<NotificationPopup> createState() => _NotificationPopupState();
}

class _NotificationPopupState extends State<NotificationPopup> with SingleTickerProviderStateMixin {
  Map<String, dynamic>? _currentData;
  late AnimationController _animController;
  late Animation<Offset> _slideAnimation;
  Timer? _hideTimer;

  @override
  void initState() {
    super.initState();
    
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _updateSlideAnimation();
    widget.notificationStream.listen(_handleNotification);
  }

  @override
  void didUpdateWidget(NotificationPopup oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.alignment != widget.alignment) {
      _updateSlideAnimation();
    }
  }

  void _updateSlideAnimation() {
    Offset beginOffset;
    if (widget.alignment.contains('Left')) {
      beginOffset = const Offset(-1.0, 0.0);
    } else if (widget.alignment == 'Top Center') {
      beginOffset = const Offset(0.0, -1.0);
    } else if (widget.alignment == 'Bottom Center') {
      beginOffset = const Offset(0.0, 1.0);
    } else {
      beginOffset = const Offset(1.0, 0.0); // Defaults to Right
    }

    _slideAnimation = Tween<Offset>(
      begin: beginOffset,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOutCubic));
  }


  void _handleNotification(Map<String, dynamic> data) async {
    setState(() {
      _currentData = data;
    });

    // Make window visible and slide in
    await windowManager.show();
    _animController.forward();

    // Reset the hide timer
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 5), () async {
      await _animController.reverse();
      await windowManager.hide();
    });
  }

  @override
  void dispose() {
    _animController.dispose();
    _hideTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_currentData == null) return const SizedBox.shrink();

    final track = _currentData!['track'] ?? 'Unknown Track';
    final speaker = _currentData!['speaker'] ?? 'Unknown Speaker';
    final artUrl = _currentData!['artUrl'];

    return SlideTransition(
      position: _slideAnimation,
      child: Container(
        margin: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E).withOpacity(0.95),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.2),
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
          ],
          border: Border.all(
            color: Colors.white.withOpacity(0.1),
            width: 1,
          ),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Row(
            children: [
              if (artUrl != null)
                Image.network(
                  artUrl,
                  headers: _currentData!['haToken'] != null 
                      ? {'Authorization': 'Bearer ${_currentData!['haToken']}'} 
                      : null,
                  width: 100,
                  height: 100,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) => _buildFallbackArt(),
                )
              else
                _buildFallbackArt(),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Now Playing on $speaker',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.6),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        track,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFallbackArt() {
    return Container(
      width: 100,
      height: 100,
      color: Colors.grey[900],
      child: const Icon(Icons.music_note, color: Colors.white54, size: 40),
    );
  }
}
