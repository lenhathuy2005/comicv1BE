import 'package:flutter/material.dart';

import '../model/user_profile.dart';
import '../service/user_service.dart';

class UserProvider extends ChangeNotifier {
  UserProvider({
    required this.userService,
  });

  final UserService userService;

  bool isLoading = false;
  String? errorMessage;
  UserProfile? profile;

  Future<void> loadMyProfile() async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      profile = await userService.getMyProfile();
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateProfile({
    required String displayName,
    String? bio,
    String? phone,
  }) async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      await userService.updateProfile(
        displayName: displayName,
        bio: bio,
        phone: phone,
      );

      await loadMyProfile();
      return true;
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  void clear() {
    profile = null;
    errorMessage = null;
    notifyListeners();
  }
}