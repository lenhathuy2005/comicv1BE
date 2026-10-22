import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../provider/afk_provider.dart';

class AfkScreen extends StatefulWidget {
  const AfkScreen({super.key});

  @override
  State<AfkScreen> createState() => _AfkScreenState();
}

class _AfkScreenState extends State<AfkScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      context.read<AfkProvider>().loadConfigs();
    });
  }

  Future<void> _startAfk(Map<String, dynamic> config) async {
    final configId = int.tryParse('${config['id']}') ?? 0;
    if (configId <= 0) return;

    final ok = await context.read<AfkProvider>().startSession(configId: configId);

    if (!mounted) return;

    final provider = context.read<AfkProvider>();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok ? 'Bắt đầu AFK thành công' : (provider.errorMessage ?? 'Không thể bắt đầu AFK'),
        ),
      ),
    );
  }

  Future<void> _finishAfk() async {
    final provider = context.read<AfkProvider>();
    final sessionId = int.tryParse('${provider.activeSession?['id']}') ?? 0;
    if (sessionId <= 0) return;

    final ok = await provider.finishSession(sessionId: sessionId);

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok ? 'Đã kết thúc phiên AFK' : (provider.errorMessage ?? 'Kết thúc AFK thất bại'),
        ),
      ),
    );
  }

  Future<void> _claimAfk() async {
    final provider = context.read<AfkProvider>();
    final sessionId = int.tryParse('${provider.activeSession?['id']}') ?? 0;
    if (sessionId <= 0) return;

    final ok = await provider.claimSession(sessionId: sessionId);

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok ? 'Nhận thưởng AFK thành công' : (provider.errorMessage ?? 'Nhận thưởng thất bại'),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AfkProvider>();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => context.read<AfkProvider>().loadConfigs(),
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            const Text(
              'AFK Farm',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),

            if (provider.activeSession != null)
              Card(
                color: Colors.orange.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Phiên AFK đang chạy',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text('Session ID: ${provider.activeSession!['id'] ?? '-'}'),
                      Text('Config ID: ${provider.activeSession!['config_id'] ?? provider.activeSession!['configId'] ?? '-'}'),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: provider.isSubmitting ? null : _finishAfk,
                              child: const Text('Kết thúc'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: provider.isSubmitting ? null : _claimAfk,
                              child: const Text('Nhận thưởng'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

            if (provider.lastResult != null) ...[
              const SizedBox(height: 12),
              Card(
                color: Colors.green.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(
                    'Kết quả AFK: ${provider.lastResult.toString()}',
                  ),
                ),
              ),
            ],

            const SizedBox(height: 12),

            if (provider.isLoading && provider.configs.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (provider.errorMessage != null && provider.configs.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 80),
                child: Center(child: Text(provider.errorMessage!)),
              )
            else if (provider.configs.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 80),
                  child: Center(child: Text('Chưa có cấu hình AFK')),
                )
              else
                ...provider.configs.map((config) {
                  final title = (config['name'] ??
                      config['config_name'] ??
                      'AFK Config')
                      .toString();

                  final description = (config['description'] ?? 'Không có mô tả').toString();
                  final durationMinutes = config['duration_minutes'] ?? config['durationMinutes'] ?? '-';

                  return Card(
                    child: ListTile(
                      leading: const CircleAvatar(
                        child: Icon(Icons.bolt),
                      ),
                      title: Text(title),
                      subtitle: Text(
                        '$description\nThời gian: $durationMinutes phút',
                      ),
                      isThreeLine: true,
                      trailing: FilledButton(
                        onPressed: provider.isSubmitting
                            ? null
                            : () => _startAfk(config),
                        child: const Text('AFK'),
                      ),
                    ),
                  );
                }),
          ],
        ),
      ),
    );
  }
}