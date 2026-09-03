import 'dart:async';
import 'package:flutter/material.dart';
import 'package:auto_size_text/auto_size_text.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:window_manager/window_manager.dart';

class NotificationPopup extends StatefulWidget {
  final Stream<Map<String, dynamic>> notificationStream;
  final String alignment;
  final String cardSize;
  final String fontFamily;

  const NotificationPopup({
    super.key, 
    required this.notificationStream, 
    required this.alignment,
    required this.cardSize,
    required this.fontFamily,
  });

  @override
  State<NotificationPopup> createState() => _NotificationPopupState();
}

class _NotificationPopupState extends State<NotificationPopup> with SingleTickerProviderStateMixin {
  Map<String, dynamic>? _currentData;
  late AnimationController _animController;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _fadeAnimation;
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
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOutCubic));

    _fadeAnimation = Tween<double>(
      begin: 0.05, // Start from 5% instead of 0% as requested!
      end: 1.0,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeIn));
  }


  void _handleNotification(Map<String, dynamic> data) async {
    // Precache the image before sliding in!
    if (data['artUrl'] != null) {
      final imageProvider = NetworkImage(
        data['artUrl'],
        headers: data['haToken'] != null ? {'Authorization': 'Bearer ${data['haToken']}'} : null,
      );
      try {
        await precacheImage(imageProvider, context);
      } catch (e) {
        debugPrint('Failed to precache image: $e');
      }
    }

    setState(() {
      _currentData = data;
    });

    // Make window visible and slide in
    _animController.forward();

    // Reset the hide timer
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 5), () async {
      await _animController.reverse();
    });
  }

  @override
  void dispose() {
    _animController.dispose();
    _hideTimer?.cancel();
    super.dispose();
  }

  TextStyle _getFontStyle(TextStyle base) {
    if (widget.fontFamily == 'Default') return base;
    try {
      return GoogleFonts.getFont(widget.fontFamily, textStyle: base);
    } catch (e) {
      return base;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_currentData == null) return const SizedBox.shrink();

    final track = _currentData!['track'] ?? 'Unknown Track';
    final speaker = _currentData!['speaker'] ?? 'Unknown Speaker';
    final artUrl = _currentData!['artUrl'];

    // Dynamic Sizing
    double imageSize = 98; // Small default
    double titleSize = 12;
    double trackSize = 16;
    double cardRadius = 12;
    double textPadding = 24;
    
    if (widget.cardSize == 'Medium') {
      imageSize = 128;
      titleSize = 14;
      trackSize = 20;
      cardRadius = 16;
      textPadding = 32;
    } else if (widget.cardSize == 'Large') {
      imageSize = 178;
      titleSize = 18;
      trackSize = 26;
      cardRadius = 24;
      textPadding = 40;
    } else if (widget.cardSize == 'Large') {
      imageSize = 178;
      titleSize = 18;
      trackSize = 26;
    }

    return SlideTransition(
      position: _slideAnimation,
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: Container(
          margin: const EdgeInsets.all(16),
          decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E).withOpacity(0.95),
          borderRadius: BorderRadius.circular(cardRadius),
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
          borderRadius: BorderRadius.circular(cardRadius),
          child: Row(
            children: [
              Stack(
                children: [
                  if (artUrl != null)
                    Image.network(
                      artUrl,
                      headers: _currentData!['haToken'] != null && !artUrl.contains('mzstatic.com')
                          ? {'Authorization': 'Bearer ${_currentData!['haToken']}'} 
                          : null,
                      width: imageSize,
                      height: imageSize,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => _buildFallbackArt(imageSize),
                    )
                  else
                    _buildFallbackArt(imageSize),
                    
                  if (_currentData!['badgeUrl'] != null)
                    Positioned(
                      bottom: 4,
                      right: 4,
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white24, width: 2),
                          boxShadow: [
                            BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 4, offset: const Offset(0, 2))
                          ],
                        ),
                        child: CircleAvatar(
                          radius: imageSize * 0.15,
                          backgroundColor: Colors.black,
                          backgroundImage: NetworkImage(
                            _currentData!['badgeUrl'],
                            headers: _currentData!['haToken'] != null 
                                ? {'Authorization': 'Bearer ${_currentData!['haToken']}'} 
                                : null,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: textPadding),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Flexible(
                        child: AutoSizeText(
                          track,
                          style: _getFontStyle(TextStyle(
                            color: Colors.white,
                            fontSize: trackSize,
                            fontWeight: FontWeight.bold,
                          )),
                          maxLines: 4,
                          minFontSize: 12,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),);
  }

  Widget _buildFallbackArt(double size) {
    return Container(
      width: size,
      height: size,
      color: Colors.grey[900],
      child: Icon(Icons.music_note, color: Colors.white54, size: size * 0.4),
    );
  }
}
