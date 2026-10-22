import '../../comic/model/chapter.dart';
import '../../comic/service/comic_service.dart';

class ReaderService {
  ReaderService({
    required this.comicService,
  });

  final ComicService comicService;

  Future<Chapter> getChapterDetail(int chapterId) async {
    return comicService.getChapterDetail(chapterId);
  }
}