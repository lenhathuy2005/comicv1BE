class NotificationItem {
  final int id;
  final String title;
  final String content;
  final bool isRead;
  final String? typeCode;
  final String? createdAt;

  NotificationItem({
    required this.id,
    required this.title,
    required this.content,
    required this.isRead,
    this.typeCode,
    this.createdAt,
  });

  factory NotificationItem.fromMap(Map<String, dynamic> map) {
    return NotificationItem(
      id: int.tryParse('${map['id']}') ?? 0,
      title: (map['title'] ?? '').toString(),
      content: (map['content'] ?? '').toString(),
      isRead: '${map['is_read']}' == '1' || map['is_read'] == true,
      typeCode: map['type_code']?.toString(),
      createdAt: map['created_at']?.toString(),
    );
  }
}