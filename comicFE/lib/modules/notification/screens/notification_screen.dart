import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../model/notification_item.dart';
import '../provider/notification_provider.dart';

class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      context.read<NotificationProvider>().loadNotifications();
    });
  }

  Future<void> _handleRead(NotificationItem item) async {
    if (item.isRead) return;

    final ok = await context.read<NotificationProvider>().readNotification(item.id);

    if (!mounted) return;

    final provider = context.read<NotificationProvider>();
    if (!ok && provider.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.errorMessage!)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => context.read<NotificationProvider>().loadNotifications(),
        child: Builder(
          builder: (context) {
            if (provider.isLoading && provider.items.isEmpty) {
              return const Center(
                child: CircularProgressIndicator(),
              );
            }

            if (provider.errorMessage != null && provider.items.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 120),
                  Center(child: Text(provider.errorMessage!)),
                ],
              );
            }

            if (provider.items.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(child: Text('Chưa có thông báo nào')),
                ],
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: provider.items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = provider.items[index];

                return Card(
                  color: item.isRead ? null : Colors.deepPurple.shade50,
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor:
                      item.isRead ? Colors.grey.shade300 : Colors.deepPurple.shade100,
                      child: Icon(
                        item.isRead
                            ? Icons.notifications_none
                            : Icons.notifications_active_outlined,
                        color: item.isRead ? Colors.black54 : Colors.deepPurple,
                      ),
                    ),
                    title: Text(
                      item.title,
                      style: TextStyle(
                        fontWeight: item.isRead ? FontWeight.w500 : FontWeight.w700,
                      ),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 4),
                        Text(item.content),
                        if (item.createdAt != null) ...[
                          const SizedBox(height: 6),
                          Text(
                            item.createdAt!,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ],
                    ),
                    trailing: item.isRead
                        ? const Icon(Icons.done, color: Colors.green)
                        : TextButton(
                      onPressed: provider.isSubmitting
                          ? null
                          : () => _handleRead(item),
                      child: const Text('Đọc'),
                    ),
                    isThreeLine: item.createdAt != null,
                    onTap: () => _handleRead(item),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}