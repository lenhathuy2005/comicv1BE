import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../provider/guild_provider.dart';

class GuildDetailScreen extends StatefulWidget {
  const GuildDetailScreen({
    super.key,
    required this.guildId,
  });

  final int guildId;

  @override
  State<GuildDetailScreen> createState() => _GuildDetailScreenState();
}

class _GuildDetailScreenState extends State<GuildDetailScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      context.read<GuildProvider>().loadGuildDetail(widget.guildId);
    });
  }

  Future<void> _joinGuild() async {
    final ok = await context.read<GuildProvider>().joinGuild(widget.guildId);

    if (!mounted) return;

    final provider = context.read<GuildProvider>();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok ? 'Gửi yêu cầu tham gia guild thành công' : (provider.errorMessage ?? 'Thao tác thất bại'),
        ),
      ),
    );
  }

  Future<void> _showDonateDialog() async {
    final pointController = TextEditingController(text: '10');

    final points = await showDialog<int>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Donate Guild'),
          content: TextField(
            controller: pointController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Contribution points',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.of(context).pop(
                  int.tryParse(pointController.text.trim()) ?? 0,
                );
              },
              child: const Text('Donate'),
            ),
          ],
        );
      },
    );

    if (points == null || points <= 0) return;

    final ok = await context.read<GuildProvider>().donateGuild(
      guildId: widget.guildId,
      contributionPoints: points,
    );

    if (!mounted) return;

    final provider = context.read<GuildProvider>();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok ? 'Donate thành công' : (provider.errorMessage ?? 'Donate thất bại'),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final guildProvider = context.watch<GuildProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết Guild'),
      ),
      body: Builder(
        builder: (context) {
          if (guildProvider.isLoading && guildProvider.guildDetail == null) {
            return const Center(child: CircularProgressIndicator());
          }

          if (guildProvider.guildDetail == null) {
            return Center(
              child: Text(guildProvider.errorMessage ?? 'Không có dữ liệu guild'),
            );
          }

          final detail = guildProvider.guildDetail!;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                (detail['name'] ?? 'Guild').toString(),
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text((detail['description'] ?? 'Không có mô tả').toString()),
              const SizedBox(height: 16),

              Card(
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.star_outline),
                      title: const Text('Level'),
                      subtitle: Text('${detail['level'] ?? 0}'),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.bolt_outlined),
                      title: const Text('Guild Power'),
                      subtitle: Text('${detail['guild_power'] ?? 0}'),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.person_outline),
                      title: const Text('Leader'),
                      subtitle: Text((detail['leader_name'] ?? 'Không rõ').toString()),
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.shield_outlined),
                      title: const Text('Status'),
                      subtitle: Text((detail['guild_status'] ?? 'Không rõ').toString()),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              FilledButton.icon(
                onPressed: guildProvider.isSubmitting ? null : _joinGuild,
                icon: const Icon(Icons.group_add_outlined),
                label: const Text('Xin tham gia guild'),
              ),
              const SizedBox(height: 12),

              OutlinedButton.icon(
                onPressed: guildProvider.isSubmitting ? null : _showDonateDialog,
                icon: const Icon(Icons.volunteer_activism_outlined),
                label: const Text('Donate guild'),
              ),
            ],
          );
        },
      ),
    );
  }
}