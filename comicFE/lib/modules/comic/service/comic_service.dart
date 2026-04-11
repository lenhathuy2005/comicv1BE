import '../../../core/network/api_client.dart';
import '../../../core/network/api_paths.dart';
import '../model/chapter.dart';
import '../model/comic.dart';

class ComicService {
  ComicService({
    required this.apiClient,
  });

  final ApiClient apiClient;

  Future<List<Comic>> getComics({
    int page = 1,
    int limit = 20,
    String? keyword,
  }) async {
    final data = await apiClient.get(
      ApiPaths.comics,
      queryParameters: {
        'page': page,
        'limit': limit,
        if (keyword != null && keyword.trim().isNotEmpty) 'keyword': keyword.trim(),
      },
    );

    final body = Map<String, dynamic>.from(data as Map);
    final items = body['items'] as List? ?? [];

    return items
        .map((e) => Comic.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Comic> getComicDetail(int comicId) async {
    final data = await apiClient.get(ApiPaths.comicDetail(comicId));
    return Comic.fromMap(Map<String, dynamic>.from(data as Map));
  }

  Future<List<Chapter>> getChaptersByComic(int comicId) async {
    final data = await apiClient.get(ApiPaths.chaptersByComic(comicId));
    final items = data as List? ?? [];

    return items
        .map((e) => Chapter.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Chapter> getChapterDetail(int chapterId) async {
    final data = await apiClient.get(ApiPaths.chapterDetail(chapterId));
    return Chapter.fromMap(Map<String, dynamic>.from(data as Map));
  }
}