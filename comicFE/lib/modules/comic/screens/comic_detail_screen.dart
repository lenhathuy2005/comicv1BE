import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../reader/screens/reader_screen.dart';
import '../provider/comic_provider.dart';

class ComicDetailScreen extends StatefulWidget {
  const ComicDetailScreen({
    super.key,
    required this.comicId,
  });

  final int comicId;

  @override
  State<ComicDetailScreen> createState() => _ComicDetailScreenState();
}

class _ComicDetailScreenState extends State<ComicDetailScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      context.read<ComicProvider>().loadComicDetail(widget.comicId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final comicProvider = context.watch<ComicProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết truyện'),
      ),
      body: Builder(
        builder: (context) {
          if (comicProvider.isLoading && comicProvider.selectedComic == null) {
            return const Center(child: CircularProgressIndicator());
          }

          if (comicProvider.selectedComic == null) {
            return Center(
              child: Text(comicProvider.errorMessage ?? 'Không có dữ liệu truyện'),
            );
          }

          final comic = comicProvider.selectedComic!;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (comic.coverImageUrl != null && comic.coverImageUrl!.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.network(
                    comic.coverImageUrl!,
                    height: 220,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      height: 220,
                      color: Colors.grey.shade200,
                      child: const Icon(Icons.image, size: 60),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              Text(
                comic.title,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text('Tác giả: ${comic.authorName ?? "Đang cập nhật"}'),
              const SizedBox(height: 6),
              Text('Trạng thái: ${comic.publicationStatus ?? "Không rõ"}'),
              const SizedBox(height: 6),
              Text('Views: ${comic.totalViews}'),
              const SizedBox(height: 6),
              Text('Follows: ${comic.totalFollows}'),
              const SizedBox(height: 16),
              Text(
                comic.summary ?? 'Chưa có mô tả',
                style: const TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 24),
              const Text(
                'Danh sách chapter',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              if (comicProvider.chapters.isEmpty)
                const Text('Chưa có chapter nào')
              else
                ...comicProvider.chapters.map(
                      (chapter) => Card(
                    child: ListTile(
                      title: Text(
                        'Chapter ${chapter.chapterNumber} - ${chapter.title}',
                      ),
                      subtitle: Text(
                        '${chapter.accessType} • ${chapter.viewCount} views',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ReaderScreen(chapterId: chapter.id),
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}