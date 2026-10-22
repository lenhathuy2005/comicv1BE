import '../../../core/network/api_client.dart';
import '../../../core/network/api_paths.dart';
import '../../../core/storage/token_storage.dart';
import '../model/auth_user.dart';

class AuthService {
  AuthService({
    required this.apiClient,
    required this.tokenStorage,
  });

  final ApiClient apiClient;
  final TokenStorage tokenStorage;

  Future<AuthUser> login({
    required String identifier,
    required String password,
  }) async {
    final data = await apiClient.post(
      ApiPaths.login,
      data: {
        'identifier': identifier,
        'password': password,
      },
    );

    final body = Map<String, dynamic>.from(data as Map);

    final accessToken = (body['accessToken'] ?? '').toString();
    final refreshToken = (body['refreshToken'] ?? '').toString();
    final sessionToken = (body['sessionToken'] ?? '').toString();

    if (accessToken.isNotEmpty) {
      await tokenStorage.saveAccessToken(accessToken);
    }
    if (refreshToken.isNotEmpty) {
      await tokenStorage.saveRefreshToken(refreshToken);
    }
    if (sessionToken.isNotEmpty) {
      await tokenStorage.saveSessionToken(sessionToken);
    }

    final userMap = Map<String, dynamic>.from(body['user'] ?? {});
    return AuthUser.fromMap(userMap);
  }

  Future<void> register({
    required String username,
    required String email,
    required String displayName,
    required String password,
  }) async {
    await apiClient.post(
      ApiPaths.register,
      data: {
        'username': username,
        'email': email,
        'displayName': displayName,
        'password': password,
      },
    );
  }

  Future<AuthUser> getMe() async {
    final data = await apiClient.get(ApiPaths.me);
    return AuthUser.fromMap(Map<String, dynamic>.from(data as Map));
  }

  Future<void> logout() async {
    try {
      final sessionToken = await tokenStorage.getSessionToken();
      if (sessionToken != null && sessionToken.isNotEmpty) {
        await apiClient.post(
          ApiPaths.logout,
          data: {
            'tokenValue': sessionToken,
          },
        );
      }
    } catch (_) {
    } finally {
      await tokenStorage.clear();
    }
  }
}