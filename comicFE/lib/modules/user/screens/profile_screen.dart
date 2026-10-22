import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/provider/auth_provider.dart';
import '../provider/user_provider.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      context.read<UserProvider>().loadMyProfile();
    });
  }

  @override
  Widget build(BuildContext context) {
    final userProvider = context.watch<UserProvider>();
    final authProvider = context.watch<AuthProvider>();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => context.read<UserProvider>().loadMyProfile(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (userProvider.isLoading && userProvider.profile == null)
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (userProvider.profile == null)
              Padding(
                padding: const EdgeInsets.only(top: 80),
                child: Center(
                  child: Text(
                    userProvider.errorMessage ?? 'Không tải được hồ sơ',
                  ),
                ),
              )
            else ...[
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.deepPurple,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 38,
                        child: Text(
                          userProvider.profile!.displayName.isNotEmpty
                              ? userProvider.profile!.displayName[0].toUpperCase()
                              : 'U',
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        userProvider.profile!.displayName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        userProvider.profile!.email,
                        style: const TextStyle(
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                Row(
                  children: [
                    Expanded(
                      child: _statCard(
                        title: 'Gold',
                        value: '${userProvider.profile!.goldBalance}',
                        icon: Icons.monetization_on_outlined,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _statCard(
                        title: 'Premium',
                        value: '${userProvider.profile!.premiumCurrency}',
                        icon: Icons.diamond_outlined,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                Row(
                  children: [
                    Expanded(
                      child: _statCard(
                        title: 'Power',
                        value: '${userProvider.profile!.powerScore}',
                        icon: Icons.flash_on_outlined,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _statCard(
                        title: 'Level',
                        value: '${userProvider.profile!.levelNumber ?? 0}',
                        icon: Icons.trending_up_outlined,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(Icons.person_outline),
                        title: const Text('Username'),
                        subtitle: Text(userProvider.profile!.username),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.workspace_premium_outlined),
                        title: const Text('VIP'),
                        subtitle: Text(
                          userProvider.profile!.vipLevelName ?? 'Thường',
                        ),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.auto_awesome_outlined),
                        title: const Text('Cảnh giới'),
                        subtitle: Text(
                          userProvider.profile!.realmName ?? 'Chưa có',
                        ),
                      ),
                      const Divider(height: 1),
                      ListTile(
                        leading: const Icon(Icons.verified_user_outlined),
                        title: const Text('Role'),
                        subtitle: Text(userProvider.profile!.roleCode),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                FilledButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const EditProfileScreen(),
                      ),
                    );
                  },
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Sửa hồ sơ'),
                ),
                const SizedBox(height: 12),

                OutlinedButton.icon(
                  onPressed: authProvider.isLoading
                      ? null
                      : () async {
                    await context.read<AuthProvider>().logout();
                    if (!mounted) return;
                    context.read<UserProvider>().clear();
                  },
                  icon: const Icon(Icons.logout),
                  label: const Text('Đăng xuất'),
                ),
              ],
          ],
        ),
      ),
    );
  }

  Widget _statCard({
    required String title,
    required String value,
    required IconData icon,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Icon(icon, size: 28),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(title),
          ],
        ),
      ),
    );
  }
}