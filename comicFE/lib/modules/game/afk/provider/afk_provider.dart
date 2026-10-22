import 'package:flutter/material.dart';

import '../service/afk_service.dart';

class AfkProvider extends ChangeNotifier {
  AfkProvider({
    required this.afkService,
  });

  final AfkService afkService;

  bool isLoading = false;
  bool isSubmitting = false;
  String? errorMessage;

  List<Map<String, dynamic>> configs = [];

  Map<String, dynamic>? activeSession;
  Map<String, dynamic>? lastResult;

  Future<void> loadConfigs() async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      configs = await afkService.getAfkConfigs();
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> startSession({
    required int configId,
  }) async {
    try {
      isSubmitting = true;
      errorMessage = null;
      notifyListeners();

      activeSession = await afkService.startAfkSession(configId: configId);
      lastResult = null;
      return true;
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      isSubmitting = false;
      notifyListeners();
    }
  }

  Future<bool> finishSession({
    required int sessionId,
  }) async {
    try {
      isSubmitting = true;
      errorMessage = null;
      notifyListeners();

      lastResult = await afkService.finishAfkSession(sessionId: sessionId);
      return true;
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      isSubmitting = false;
      notifyListeners();
    }
  }

  Future<bool> claimSession({
    required int sessionId,
  }) async {
    try {
      isSubmitting = true;
      errorMessage = null;
      notifyListeners();

      lastResult = await afkService.claimAfkSession(sessionId: sessionId);
      activeSession = null;
      return true;
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      isSubmitting = false;
      notifyListeners();
    }
  }

  void clearResult() {
    lastResult = null;
    notifyListeners();
  }
}