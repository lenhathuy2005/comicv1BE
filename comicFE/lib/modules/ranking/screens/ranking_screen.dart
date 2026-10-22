import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../model/ranking_entry.dart';
import '../provider/ranking_provider.dart';

class RankingScreen extends StatefulWidget {
  const RankingScreen({super.key});

  @override
  State<RankingScreen> createState() => _RankingScreenState();
}

class _RankingScreenState extends State<RankingScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      context.read<RankingProvider>().bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<RankingProvider>();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => context.read<RankingProvider>().changeType(
          context.read<RankingProvider>().selectedType,
        ),
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            const SizedBox(height: 4),
            const Text(
              'Bảng xếp hạng',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),

            if (provider.rankingTypes.isNotEmpty)
              DropdownButtonFormField<String>(
                value: provider.selectedType,
                items: provider.rankingTypes
                    .map(
                      (type) => DropdownMenuItem(
                    value: type,
                    child: Text(type),
                  ),
                )
                    .toList(),
                decoration: const InputDecoration(
                  labelText: 'Chọn loại BXH',
                  border: OutlineInputBorder(),
                ),
                onChanged: provider.isLoading
                    ? null
                    : (value) {
                  if (value != null) {
                    context.read<RankingProvider>().changeType(value);
                  }
                },
              ),

            const SizedBox(height: 16),

            if (provider.myRanking != null)
              Card(
                color: Colors.amber.shade50,
                child: ListTile(
                  leading: const CircleAvatar(
                    child: Icon(Icons.person),
                  ),
                  title: Text(
                    'Thứ hạng của bạn: ${provider.myRanking!['rank_position'] ?? provider.myRanking!['rank'] ?? '-'}',
                  ),
                  subtitle: Text(
                    'Điểm: ${provider.myRanking!['score_value'] ?? provider.myRanking!['score'] ?? '-'}',
                  ),
                ),
              ),

            const SizedBox(height: 12),

            if (provider.isLoading && provider.rankings.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (provider.errorMessage != null && provider.rankings.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 80),
                child: Center(child: Text(provider.errorMessage!)),
              )
            else if (provider.rankings.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 80),
                  child: Center(child: Text('Chưa có dữ liệu BXH')),
                )
              else
                ...provider.rankings.map((entry) => _rankingCard(entry)),
          ],
        ),
      ),
    );
  }

  Widget _rankingCard(RankingEntry entry) {
    Color? medalColor;
    if (entry.rankPosition == 1) {
      medalColor = Colors.amber;
    } else if (entry.rankPosition == 2) {
      medalColor = Colors.grey;
    } else if (entry.rankPosition == 3) {
      medalColor = Colors.brown;
    }

    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: medalColor ?? Colors.deepPurple.shade100,
          child: Text('${entry.rankPosition}'),
        ),
        title: Text(
          entry.displayName,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(
          'Score: ${entry.scoreValue}'
              '${entry.realmName != null ? ' • ${entry.realmName}' : ''}'
              '${entry.levelNumber != null ? ' • Lv ${entry.levelNumber}' : ''}',
        ),
        trailing: entry.rankLabel != null
            ? Chip(label: Text(entry.rankLabel!))
            : null,
      ),
    );
  }
}