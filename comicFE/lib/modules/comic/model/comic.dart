class Comic {
  final int id;
  final String title;
  final String slug;
  final String? coverImageUrl;
  final String? bannerImageUrl;
  final String? summary;
  final String? authorName;
  final String? publicationStatus;
  final String? visibilityStatus;
  final String? ageRating;
  final int totalChapters;
  final int totalViews;
  final int totalFollows;
  final String? genres;

  Comic({
    required this.id,
    required this.title,
    required this.slug,
    this.coverImageUrl,
    this.bannerImageUrl,
    this.summary,
    this.authorName,
    this.publicationStatus,
    this.visibilityStatus,
    this.ageRating,
    required this.totalChapters,
    required this.totalViews,
    required this.totalFollows,
    this.genres,
  });

  factory Comic.fromMap(Map<String, dynamic> map) {
    int toInt(dynamic value) => int.tryParse('$value') ?? 0;

    return Comic(
      id: toInt(map['id']),
      title: (map['title'] ?? '').toString(),
      slug: (map['slug'] ?? '').toString(),
      coverImageUrl: map['cover_image_url']?.toString(),
      bannerImageUrl: map['banner_image_url']?.toString(),
      summary: map['summary']?.toString(),
      authorName: map['author_name']?.toString(),
      publicationStatus: map['publication_status']?.toString(),
      visibilityStatus: map['visibility_status']?.toString(),
      ageRating: map['age_rating']?.toString(),
      totalChapters: toInt(map['total_chapters']),
      totalViews: toInt(map['total_views']),
      totalFollows: toInt(map['total_follows']),
      genres: map['genres']?.toString(),
    );
  }
}