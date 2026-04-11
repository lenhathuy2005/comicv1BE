class ApiResult<T> {
  final bool success;
  final String message;
  final T? data;

  ApiResult({
    required this.success,
    required this.message,
    this.data,
  });

  factory ApiResult.fromMap(
      Map<String, dynamic> map,
      T Function(dynamic raw)? parser,
      ) {
    return ApiResult<T>(
      success: map['success'] == true,
      message: (map['message'] ?? '').toString(),
      data: parser != null ? parser(map['data']) : map['data'] as T?,
    );
  }
}