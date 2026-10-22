import 'package:flutter/material.dart';

class EditProfileScreen extends StatelessWidget {
  const EditProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sửa hồ sơ'),
      ),
      body: const Padding(
        padding: EdgeInsets.all(16),
        child: Text(
          'Backend hiện tại chưa có API update profile public cho app-user.\n\n'
              'Muốn màn này hoạt động thật, bạn cần thêm route như:\n'
              'PATCH /api/users/me\n'
              'hoặc\n'
              'PATCH /api/auth/me\n\n'
              'Hiện tại file này để giữ đúng cấu trúc app lớn.',
          style: TextStyle(fontSize: 16),
        ),
      ),
    );
  }
}