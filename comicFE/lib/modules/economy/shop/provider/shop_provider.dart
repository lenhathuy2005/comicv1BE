import 'package:flutter/material.dart';

import '../model/shop_item.dart';
import '../service/shop_service.dart';

class ShopProvider extends ChangeNotifier {
  ShopProvider({
    required this.shopService,
  });

  final ShopService shopService;

  bool isLoading = false;
  bool isBuying = false;
  String? errorMessage;
  List<ShopItem> items = [];

  Future<void> loadShopItems() async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      items = await shopService.getShopItems();
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> buyItem({
    required int shopItemId,
    required int quantity,
  }) async {
    try {
      isBuying = true;
      errorMessage = null;
      notifyListeners();

      await shopService.buyItem(
        shopItemId: shopItemId,
        quantity: quantity,
      );

      return true;
    } catch (error) {
      errorMessage = error.toString().replaceFirst('Exception: ', '');
      return false;
    } finally {
      isBuying = false;
      notifyListeners();
    }
  }
}