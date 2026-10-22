import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../model/guild.dart';
import '../provider/guild_provider.dart';
import 'guild_detail_screen.dart';

class GuildScreen extends StatefulWidget {
  const GuildScreen({super.key});

  @override
  State<GuildScreen> createState() => _GuildScreenState();
}

class _GuildScreenState extends State<GuildScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      context.read<GuildProvider>().loadGuilds();
    });
  }

  Future<void> _showCreateGuildDialog() async {
    final nameController = TextEditingController();
    final slugController = TextEditingController();
    final descController = TextEditingController();

    final ok = await showDialog<bool>(
      context: context,
      builder: (context) {
        final provider = context.watch<GuildProvider>();

        return AlertDialog(
          title: const Text('Tạo Guild'),
          content: SingleChildScrollView(
            child: Column(
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Tên guild',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: slugController,
                  decoration: const InputDecoration(
                    labelText: 'Slug',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Mô tả',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: provider.isSubmitting
                  ? null
                  : () => Navigator.of(context).pop(false),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: provider.isSubmitting
                  ? null
                  : () async {
                final success = await context.read<GuildProvider>().createGuild(
                  name: nameController.text.trim(),
                  slug: slugController.text.trim(),
                  description: descController.text.trim(),
                );

                if (!context.mounted) return;
                Navigator.of(context).pop(success);
              },
              child: provider.isSubmitting
                  ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
                  : const Text('Tạo'),
            ),
          ],
        );
      },
    );

    if (!mounted) return;

    final provider = context.read<GuildProvider>();

    if (ok == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tạo guild thành công')),
      );
      provider.loadGuilds();
    } else if (provider.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.errorMessage!)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final guildProvider = context.watch<GuildProvider>();

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateGuildDialog,
        icon: const Icon(Icons.add),
        label: const Text('Tạo Guild'),
      ),
      body: RefreshIndicator(
        onRefresh: () => context.read<GuildProvider>().loadGuilds(),
        child: Builder(
          builder: (context) {
            if (guildProvider.isLoading && guildProvider.guilds.isEmpty) {
              return const Center(child: CircularProgressIndicator());
            }

            if (guildProvider.errorMessage != null &&
                guildProvider.guilds.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 120),
                  Center(child: Text(guildProvider.errorMessage!)),
                ],
              );
            }

            if (guildProvider.guilds.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: Text('Chưa có guild nào')),
                ],
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: guildProvider.guilds.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final guild = guildProvider.guilds[index];
                return _guildCard(guild);
              },
            );
          },
        ),
      ),
    );
  }

  Widget _guildCard(Guild guild) {
    return Card(
      child: ListTile(
        leading: guild.logoUrl != null && guild.logoUrl!.isNotEmpty
            ? ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.network(
            guild.logoUrl!,
            width: 52,
            height: 52,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const Icon(Icons.groups),
          ),
        )
            : const CircleAvatar(
          child: Icon(Icons.groups),
        ),
        title: Text(guild.name),
        subtitle: Text(
          '${guild.description ?? "Không có mô tả"}\n'
              'Lv: ${guild.level ?? 0} • Power: ${guild.guildPower ?? 0}',
        ),
        isThreeLine: true,
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => GuildDetailScreen(guildId: guild.id),
            ),
          );
        },
      ),
    );
  }
}