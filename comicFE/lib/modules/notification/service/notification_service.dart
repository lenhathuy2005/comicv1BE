import '../../../core/network/api_client.dart';
import '../../../core/network/api_paths.dart';
import '../model/notification_item.dart';

class NotificationService {
  NotificationService({
    required this.apiClient,
  });

  final ApiClient apiClient;

  Future<List<NotificationItem>> getMyNotifications() async {
    final data = await apiClient.get(ApiPaths.myNotifications);
    final items = data as List? ?? [];

    return items
        .map((e) => NotificationItem.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> markAsRead(int notificationId) async {
    await apiClient.patch(ApiPaths.markNotificationRead(notificationId));
  }
}