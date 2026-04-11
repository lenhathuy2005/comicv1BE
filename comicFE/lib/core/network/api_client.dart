import 'package:dio/dio.dart';

import '../config/app_env.dart';
import '../storage/token_storage.dart';

class ApiClient {
  ApiClient({required this.tokenStorage}) {
    dio = Dio(
      BaseOptions(
        baseUrl: AppEnv.baseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 20),
        sendTimeout: const Duration(seconds: 20),
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await tokenStorage.getAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final TokenStorage tokenStorage;
  late final Dio dio;

  Map<String, dynamic> _toMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    throw Exception('Dữ liệu API không đúng định dạng');
  }

  String _extractMessage(dynamic error) {
    if (error is DioException) {
      final body = error.response?.data;

      if (body is Map && body['message'] != null) {
        return body['message'].toString();
      }

      if (error.message != null && error.message!.trim().isNotEmpty) {
        return error.message!;
      }

      return 'Lỗi kết nối máy chủ';
    }

    return error.toString().replaceFirst('Exception: ', '');
  }

  dynamic _unwrapResponse(Map<String, dynamic> body) {
    if (body.containsKey('success') && body['success'] == false) {
      throw Exception((body['message'] ?? 'Có lỗi xảy ra').toString());
    }

    if (body.containsKey('data')) {
      return body['data'];
    }

    return body;
  }

  Future<dynamic> get(
      String path, {
        Map<String, dynamic>? queryParameters,
      }) async {
    try {
      final response = await dio.get(
        path,
        queryParameters: queryParameters,
      );
      final body = _toMap(response.data);
      return _unwrapResponse(body);
    } catch (error) {
      throw Exception(_extractMessage(error));
    }
  }

  Future<dynamic> post(
      String path, {
        dynamic data,
        Map<String, dynamic>? queryParameters,
      }) async {
    try {
      final response = await dio.post(
        path,
        data: data,
        queryParameters: queryParameters,
      );
      final body = _toMap(response.data);
      return _unwrapResponse(body);
    } catch (error) {
      throw Exception(_extractMessage(error));
    }
  }

  Future<dynamic> patch(
      String path, {
        dynamic data,
        Map<String, dynamic>? queryParameters,
      }) async {
    try {
      final response = await dio.patch(
        path,
        data: data,
        queryParameters: queryParameters,
      );
      final body = _toMap(response.data);
      return _unwrapResponse(body);
    } catch (error) {
      throw Exception(_extractMessage(error));
    }
  }

  Future<dynamic> delete(
      String path, {
        dynamic data,
        Map<String, dynamic>? queryParameters,
      }) async {
    try {
      final response = await dio.delete(
        path,
        data: data,
        queryParameters: queryParameters,
      );
      final body = _toMap(response.data);
      return _unwrapResponse(body);
    } catch (error) {
      throw Exception(_extractMessage(error));
    }
  }
}