import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_paths.dart';
import '../model/shop_item.dart';

class ShopService {
  ShopService({
    required this.apiClient,
  });

  final ApiClient apiClient;

  Future<List<ShopItem>> getShopItems() async {
    final data = await apiClient.get(ApiPaths.shopItems);
    final items = data as List? ?? [];

    return items
        .map((e) => ShopItem.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Map<String, dynamic>> buyItem({
    required int shopItemId,
    required int quantity,
  }) async {
    final data = await apiClient.post(
      ApiPaths.buyShopItem(shopItemId),
      data: {
        'quantity': quantity,
      },
    );

    return Map<String, dynamic>.from(data as Map);
  }
}