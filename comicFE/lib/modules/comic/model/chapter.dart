class ChapterImage {
  final int id;
  final String imageUrl;
  final int displayOrder;

  ChapterImage({
    required this.id,
    required this.imageUrl,
    required this.displayOrder,
  });

  factory ChapterImage.fromMap(Map<String, dynamic> map) {
    return ChapterImage(
      id: int.tryParse('${map['id']}') ?? 0,
      imageUrl: (map['image_url'] ?? map['imageUrl'] ?? '').toString(),
      displayOrder: int.tryParse('${map['display_order'] ?? map['displayOrder']}') ?? 0,
    );
  }
}

class Chapter {
  final int id;
  final int comicId;
  final double chapterNumber;
  final String title;
  final String slug;
  final String accessType;
  final String publishStatus;
  final int viewCount;
  final String? comicTitle;
  final String? releasedAt;
  final List<ChapterImage> images;

  Chapter({
    required this.id,
    required this.comicId,
    required this.chapterNumber,
    required this.title,
    required this.slug,
    required this.accessType,
    required this.publishStatus,
    required this.viewCount,
    this.comicTitle,
    this.releasedAt,
    required this.images,
  });

  factory Chapter.fromMap(Map<String, dynamic> map) {
    final rawImages = map['images'] as List? ?? [];

    return Chapter(
      id: int.tryParse('${map['id']}') ?? 0,
      comicId: int.tryParse('${map['comic_id'] ?? map['comicId']}') ?? 0,
      chapterNumber: double.tryParse('${map['chapter_number'] ?? map['chapterNumber']}') ?? 0,
      title: (map['title'] ?? '').toString(),
      slug: (map['slug'] ?? '').toString(),
      accessType: (map['access_type'] ?? map['accessType'] ?? 'free').toString(),
      publishStatus: (map['publish_status'] ?? map['publishStatus'] ?? '').toString(),
      viewCount: int.tryParse('${map['view_count'] ?? map['viewCount']}') ?? 0,
      comicTitle: map['comic_title']?.toString(),
      releasedAt: map['released_at']?.toString(),
      images: rawImages
          .map((e) => ChapterImage.fromMap(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}