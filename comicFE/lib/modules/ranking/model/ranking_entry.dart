class RankingEntry {
  final int rankPosition;
  final int userId;
  final String displayName;
  final String? avatarUrl;
  final int scoreValue;
  final String? rankLabel;
  final String? realmName;
  final int? levelNumber;

  RankingEntry({
    required this.rankPosition,
    required this.userId,
    required this.displayName,
    this.avatarUrl,
    required this.scoreValue,
    this.rankLabel,
    this.realmName,
    this.levelNumber,
  });

  factory RankingEntry.fromMap(Map<String, dynamic> map) {
    int toInt(dynamic value) => int.tryParse('$value') ?? 0;
    int? toNullableInt(dynamic value) =>
        value == null ? null : int.tryParse('$value');

    return RankingEntry(
      rankPosition: toInt(map['rank_position'] ?? map['rank'] ?? map['position']),
      userId: toInt(map['user_id'] ?? map['userId']),
      displayName: (map['display_name'] ?? map['displayName'] ?? 'Unknown').toString(),
      avatarUrl: map['avatar_url']?.toString(),
      scoreValue: toInt(map['score_value'] ?? map['score'] ?? map['value']),
      rankLabel: map['rank_label']?.toString(),
      realmName: map['realm_name']?.toString(),
      levelNumber: toNullableInt(map['level_number']),
    );
  }
}