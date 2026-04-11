class ShopItem {
  final int id;
  final int itemId;
  final String itemCode;
  final String itemName;
  final String? description;
  final String? iconUrl;
  final String? rarity;
  final int priceGold;
  final int pricePremium;
  final int? stockQuantity;
  final int? dailyPurchaseLimit;
  final int? vipRequiredLevel;
  final bool isActive;

  ShopItem({
    required this.id,
    required this.itemId,
    required this.itemCode,
    required this.itemName,
    this.description,
    this.iconUrl,
    this.rarity,
    required this.priceGold,
    required this.pricePremium,
    this.stockQuantity,
    this.dailyPurchaseLimit,
    this.vipRequiredLevel,
    required this.isActive,
  });

  factory ShopItem.fromMap(Map<String, dynamic> map) {
    int toInt(dynamic value) => int.tryParse('$value') ?? 0;
    int? toNullableInt(dynamic value) =>
        value == null ? null : int.tryParse('$value');

    return ShopItem(
      id: toInt(map['id']),
      itemId: toInt(map['item_id'] ?? map['itemId']),
      itemCode: (map['item_code'] ?? '').toString(),
      itemName: (map['item_name'] ?? '').toString(),
      description: map['description']?.toString(),
      iconUrl: map['icon_url']?.toString(),
      rarity: map['rarity']?.toString(),
      priceGold: toInt(map['price_gold']),
      pricePremium: toInt(map['price_premium']),
      stockQuantity: toNullableInt(map['stock_quantity']),
      dailyPurchaseLimit: toNullableInt(map['daily_purchase_limit']),
      vipRequiredLevel: toNullableInt(map['vip_required_level']),
      isActive: '${map['is_active']}' == '1' || map['is_active'] == true,
    );
  }
}