import '../../../core/network/api_client.dart';
import '../../../core/network/api_paths.dart';
import '../model/guild.dart';

class GuildService {
  GuildService({
    required this.apiClient,
  });

  final ApiClient apiClient;

  Future<List<Guild>> getGuilds() async {
    final data = await apiClient.get(ApiPaths.guilds);
    final items = data as List? ?? [];

    return items
        .map((e) => Guild.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Map<String, dynamic>> createGuild({
    required String name,
    required String slug,
    String? description,
  }) async {
    final data = await apiClient.post(
      ApiPaths.guilds,
      data: {
        'name': name,
        'slug': slug,
        'description': description,
      },
    );

    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> getGuildDetail(int guildId) async {
    final data = await apiClient.get(ApiPaths.guildDetail(guildId));
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> joinGuild(int guildId) async {
    final data = await apiClient.post(ApiPaths.guildJoinRequests(guildId));
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> donateGuild({
    required int guildId,
    required int contributionPoints,
  }) async {
    final data = await apiClient.post(
      ApiPaths.guildDonations(guildId),
      data: {
        'contributionPoints': contributionPoints,
      },
    );

    return Map<String, dynamic>.from(data as Map);
  }
}