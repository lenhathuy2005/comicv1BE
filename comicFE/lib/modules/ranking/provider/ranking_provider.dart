import 'package:flutter/material.dart';

import '../model/ranking_entry.dart';
import '../service/ranking_service.dart';

class RankingProvider extends ChangeNotifier {
  RankingProvider({
    required this.rankingService,
  });

  final RankingService rankingService;

  bool isLoading = false;
  String? errorMessage;

  List<String> rankingTypes = [];
  String selectedType = 'power';
  List<RankingEntry> rankings = [];
  Map<String, dynamic>? myRanking;

  Future<void> bootstrap() async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      final types = await rankingService.getRankingTypes();
      if (types.isNotEmpty) {
        rankingTypes = types;
        selectedType = types.first;
      } else {
        rankingTypes = ['power'];
        selectedType = 'power';
      }

      rankings = await rankingService.getRankingByType(selectedType);

      try {
        myRanking = await rankingService.getMyRankingByType(selectedType);
      } catch (_) {
        myRanking = null;
      }
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> changeType(String typeCode) async {
    try {
      isLoading = true;
      errorMessage = null;
      selectedType = typeCode;
      notifyListeners();

      rankings = await rankingService.getRankingByType(typeCode);

      try {
        myRanking = await rankingService.getMyRankingByType(typeCode);
      } catch (_) {
        myRanking = null;
      }
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }
}