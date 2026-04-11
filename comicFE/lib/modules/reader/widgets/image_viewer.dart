import 'package:flutter/material.dart';

class ImageViewer extends StatelessWidget {
  const ImageViewer({
    super.key,
    required this.imageUrl,
  });

  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return InteractiveViewer(
      minScale: 1,
      maxScale: 4,
      child: Image.network(
        imageUrl,
        width: double.infinity,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) {
          return Container(
            height: 220,
            alignment: Alignment.center,
            color: Colors.grey.shade200,
            child: const Text('Không tải được ảnh'),
          );
        },
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;

          return SizedBox(
            height: 220,
            child: Center(
              child: CircularProgressIndicator(
                value: loadingProgress.expectedTotalBytes != null
                    ? loadingProgress.cumulativeBytesLoaded /
                    loadingProgress.expectedTotalBytes!
                    : null,
              ),
            ),
          );
        },
      ),
    );
  }
}