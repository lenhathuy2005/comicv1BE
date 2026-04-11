import '../../../core/network/api_client.dart';
import '../../../core/network/api_paths.dart';
import '../model/ranking_entry.dart';

class RankingService {
  RankingService({
    required this.apiClient,
  });

  final ApiClient apiClient;

  Future<List<String>> getRankingTypes() async {
    final data = await apiClient.get(ApiPaths.rankingTypes);
    final items = data as List? ?? [];

    return items.map((e) {
      if (e is Map) {
        final map = Map<String, dynamic>.from(e);
        return (map['type_code'] ?? map['code'] ?? '').toString();
      }
      return e.toString();
    }).where((e) => e.isNotEmpty).toList();
  }

  Future<List<RankingEntry>> getRankingByType(String typeCode) async {
    final data = await apiClient.get(ApiPaths.rankingByType(typeCode));
    final items = data as List? ?? [];

    return items
        .map((e) => RankingEntry.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Map<String, dynamic>> getMyRankingByType(String typeCode) async {
    final data = await apiClient.get(ApiPaths.myRankingByType(typeCode));
    return Map<String, dynamic>.from(data as Map);
  }
}