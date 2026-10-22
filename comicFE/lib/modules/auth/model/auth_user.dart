class AuthUser {
  final int id;
  final String username;
  final String email;
  final String displayName;
  final String roleCode;

  AuthUser({
    required this.id,
    required this.username,
    required this.email,
    required this.displayName,
    required this.roleCode,
  });

  factory AuthUser.fromMap(Map<String, dynamic> map) {
    return AuthUser(
      id: int.tryParse('${map['id']}') ?? 0,
      username: (map['username'] ?? '').toString(),
      email: (map['email'] ?? '').toString(),
      displayName: (map['displayName'] ?? map['display_name'] ?? '').toString(),
      roleCode: (map['roleCode'] ?? map['role_code'] ?? 'user').toString(),
    );
  }
}