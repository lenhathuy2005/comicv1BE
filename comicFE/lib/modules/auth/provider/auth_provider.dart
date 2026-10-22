import 'package:flutter/material.dart';

import '../model/auth_user.dart';
import '../service/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider({
    required this.authService,
  });

  final AuthService authService;

  bool isBooting = true;
  bool isLoading = false;
  AuthUser? currentUser;
  String? errorMessage;

  bool get isLoggedIn => currentUser != null;

  Future<void> bootstrap() async {
    try {
      currentUser = await authService.getMe();
    } catch (_) {
      currentUser = null;
    } finally {
      isBooting = false;
      notifyListeners();
    }
  }

  Future<bool> login({
    required String identifier,
    required String password,
  }) async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      currentUser = await authService.login(
        identifier: identifier,
        password: password,
      );

      return true;
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> register({
    required String username,
    required String email,
    required String displayName,
    required String password,
  }) async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      await authService.register(
        username: username,
        email: email,
        displayName: displayName,
        password: password,
      );

      return true;
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    isLoading = true;
    notifyListeners();

    await authService.logout();
    currentUser = null;

    isLoading = false;
    notifyListeners();
  }
}