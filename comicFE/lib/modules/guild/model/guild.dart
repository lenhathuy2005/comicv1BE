class Guild {
  final int id;
  final String name;
  final String slug;
  final String? description;
  final String? logoUrl;
  final int? level;
  final int? guildPower;
  final String? guildStatus;
  final String? leaderName;

  Guild({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.logoUrl,
    this.level,
    this.guildPower,
    this.guildStatus,
    this.leaderName,
  });

  factory Guild.fromMap(Map<String, dynamic> map) {
    int? toNullableInt(dynamic value) =>
        value == null ? null : int.tryParse('$value');

    return Guild(
      id: int.tryParse('${map['id']}') ?? 0,
      name: (map['name'] ?? '').toString(),
      slug: (map['slug'] ?? '').toString(),
      description: map['description']?.toString(),
      logoUrl: map['logo_url']?.toString(),
      level: toNullableInt(map['level']),
      guildPower: toNullableInt(map['guild_power']),
      guildStatus: map['guild_status']?.toString(),
      leaderName: map['leader_name']?.toString(),
    );
  }
}