class UserProfile {
  final int id;
  final String username;
  final String email;
  final String displayName;
  final String roleCode;

  final int goldBalance;
  final int premiumCurrency;
  final int powerScore;

  final String? realmName;
  final int? levelNumber;
  final String? vipLevelName;
  final int? vipLevelNumber;

  final String? avatarUrl;
  final String? accountStatus;

  UserProfile({
    required this.id,
    required this.username,
    required this.email,
    required this.displayName,
    required this.roleCode,
    required this.goldBalance,
    required this.premiumCurrency,
    required this.powerScore,
    this.realmName,
    this.levelNumber,
    this.vipLevelName,
    this.vipLevelNumber,
    this.avatarUrl,
    this.accountStatus,
  });

  factory UserProfile.fromMap(Map<String, dynamic> map) {
    int toInt(dynamic value) => int.tryParse('$value') ?? 0;
    int? toNullableInt(dynamic value) =>
        value == null ? null : int.tryParse('$value');

    return UserProfile(
      id: toInt(map['id']),
      username: (map['username'] ?? '').toString(),
      email: (map['email'] ?? '').toString(),
      displayName: (map['display_name'] ?? map['displayName'] ?? '').toString(),
      roleCode: (map['role_code'] ?? map['roleCode'] ?? 'user').toString(),
      goldBalance: toInt(map['gold_balance']),
      premiumCurrency: toInt(map['premium_currency']),
      powerScore: toInt(map['power_score']),
      realmName: map['realm_name']?.toString(),
      levelNumber: toNullableInt(map['level_number']),
      vipLevelName: map['vip_level_name']?.toString(),
      vipLevelNumber: toNullableInt(map['vip_level_number']),
      avatarUrl: map['avatar_url']?.toString(),
      accountStatus: map['account_status']?.toString(),
    );
  }
}