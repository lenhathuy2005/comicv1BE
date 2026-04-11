import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_paths.dart';

class AfkService {
  AfkService({
    required this.apiClient,
  });

  final ApiClient apiClient;

  Future<List<Map<String, dynamic>>> getAfkConfigs() async {
    final data = await apiClient.get(ApiPaths.afkConfigs);
    final items = data as List? ?? [];

    return items
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  Future<Map<String, dynamic>> startAfkSession({
    required int configId,
  }) async {
    final data = await apiClient.post(
      ApiPaths.afkSessions,
      data: {
        'configId': configId,
      },
    );

    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> finishAfkSession({
    required int sessionId,
  }) async {
    final data = await apiClient.post(
      ApiPaths.finishAfkSession(sessionId),
    );

    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> claimAfkSession({
    required int sessionId,
  }) async {
    final data = await apiClient.post(
      ApiPaths.claimAfkSession(sessionId),
    );

    return Map<String, dynamic>.from(data as Map);
  }
}