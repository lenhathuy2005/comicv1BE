import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../comic/model/chapter.dart';
import '../../comic/service/comic_service.dart';
import '../widgets/image_viewer.dart';

class ReaderScreen extends StatefulWidget {
  const ReaderScreen({
    super.key,
    required this.chapterId,
  });

  final int chapterId;

  @override
  State<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends State<ReaderScreen> {
  late Future<Chapter> _chapterFuture;

  @override
  void initState() {
    super.initState();
    _chapterFuture = _loadChapter();
  }

  Future<Chapter> _loadChapter() {
    return context.read<ComicService>().getChapterDetail(widget.chapterId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đọc truyện'),
      ),
      body: FutureBuilder<Chapter>(
        future: _chapterFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(),
            );
          }

          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  snapshot.error.toString().replaceFirst('Exception: ', ''),
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }

          if (!snapshot.hasData) {
            return const Center(
              child: Text('Không có dữ liệu chapter'),
            );
          }

          final chapter = snapshot.data!;

          return Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                color: Colors.deepPurple.shade50,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      chapter.comicTitle ?? 'Comic',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Chapter ${chapter.chapterNumber} - ${chapter.title}',
                    ),
                  ],
                ),
              ),
              Expanded(
                child: chapter.images.isEmpty
                    ? const Center(
                  child: Text('Chapter này chưa có ảnh'),
                )
                    : ListView.builder(
                  itemCount: chapter.images.length,
                  itemBuilder: (context, index) {
                    final image = chapter.images[index];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ImageViewer(
                        imageUrl: image.imageUrl,
                      ),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}