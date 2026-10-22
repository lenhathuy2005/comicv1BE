import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../provider/comic_provider.dart';
import 'comic_detail_screen.dart';

class ComicListScreen extends StatefulWidget {
  const ComicListScreen({super.key});

  @override
  State<ComicListScreen> createState() => _ComicListScreenState();
}

class _ComicListScreenState extends State<ComicListScreen> {
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      context.read<ComicProvider>().loadComics();
    });
  }

  void _search() {
    context.read<ComicProvider>().loadComics(
      keyword: _searchController.text.trim(),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final comicProvider = context.watch<ComicProvider>();

    return Scaffold(
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              onSubmitted: (_) => _search(),
              decoration: InputDecoration(
                hintText: 'Tìm truyện...',
                border: const OutlineInputBorder(),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  onPressed: _search,
                  icon: const Icon(Icons.arrow_forward),
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => context.read<ComicProvider>().loadComics(
                keyword: _searchController.text.trim(),
              ),
              child: Builder(
                builder: (context) {
                  if (comicProvider.isLoading && comicProvider.comics.isEmpty) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (comicProvider.errorMessage != null &&
                      comicProvider.comics.isEmpty) {
                    return ListView(
                      children: [
                        const SizedBox(height: 120),
                        Center(
                          child: Text(comicProvider.errorMessage!),
                        ),
                      ],
                    );
                  }

                  if (comicProvider.comics.isEmpty) {
                    return ListView(
                      children: const [
                        SizedBox(height: 120),
                        Center(
                          child: Text('Chưa có truyện nào'),
                        ),
                      ],
                    );
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: comicProvider.comics.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final comic = comicProvider.comics[index];

                      return Card(
                        child: ListTile(
                          leading: comic.coverImageUrl != null &&
                              comic.coverImageUrl!.isNotEmpty
                              ? ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              comic.coverImageUrl!,
                              width: 52,
                              height: 52,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const Icon(Icons.image),
                            ),
                          )
                              : const Icon(Icons.menu_book),
                          title: Text(comic.title),
                          subtitle: Text(
                            'Chapter: ${comic.totalChapters} • Views: ${comic.totalViews}',
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ComicDetailScreen(comicId: comic.id),
                              ),
                            );
                          },
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}