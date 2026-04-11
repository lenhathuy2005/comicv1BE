import 'package:flutter/material.dart';

import '../model/notification_item.dart';
import '../service/notification_service.dart';

class NotificationProvider extends ChangeNotifier {
  NotificationProvider({
    required this.notificationService,
  });

  final NotificationService notificationService;

  bool isLoading = false;
  bool isSubmitting = false;
  String? errorMessage;

  List<NotificationItem> items = [];

  Future<void> loadNotifications() async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      items = await notificationService.getMyNotifications();
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> readNotification(int notificationId) async {
    try {
      isSubmitting = true;
      errorMessage = null;
      notifyListeners();

      await notificationService.markAsRead(notificationId);

      final index = items.indexWhere((e) => e.id == notificationId);
      if (index != -1) {
        final old = items[index];
        items[index] = NotificationItem(
          id: old.id,
          title: old.title,
          content: old.content,
          isRead: true,
          typeCode: old.typeCode,
          createdAt: old.createdAt,
        );
      }

      return true;
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      isSubmitting = false;
      notifyListeners();
    }
  }
}