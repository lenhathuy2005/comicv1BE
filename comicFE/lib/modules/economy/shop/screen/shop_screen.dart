import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../model/shop_item.dart';
import '../provider/shop_provider.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      context.read<ShopProvider>().loadShopItems();
    });
  }

  Future<void> _showBuyDialog(ShopItem item) async {
    final quantityController = TextEditingController(text: '1');

    final quantity = await showDialog<int>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text('Mua ${item.itemName}'),
          content: TextField(
            controller: quantityController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Số lượng',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.of(context).pop(
                  int.tryParse(quantityController.text.trim()) ?? 1,
                );
              },
              child: const Text('Mua'),
            ),
          ],
        );
      },
    );

    if (quantity == null) return;

    final ok = await context.read<ShopProvider>().buyItem(
      shopItemId: item.id,
      quantity: quantity,
    );

    if (!mounted) return;

    final provider = context.read<ShopProvider>();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok ? 'Mua thành công' : (provider.errorMessage ?? 'Mua thất bại'),
        ),
      ),
    );

    if (ok) {
      context.read<ShopProvider>().loadShopItems();
    }
  }

  @override
  Widget build(BuildContext context) {
    final shopProvider = context.watch<ShopProvider>();

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => context.read<ShopProvider>().loadShopItems(),
        child: Builder(
          builder: (context) {
            if (shopProvider.isLoading && shopProvider.items.isEmpty) {
              return const Center(
                child: CircularProgressIndicator(),
              );
            }

            if (shopProvider.errorMessage != null &&
                shopProvider.items.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 120),
                  Center(
                    child: Text(shopProvider.errorMessage!),
                  ),
                ],
              );
            }

            if (shopProvider.items.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 120),
                  Center(
                    child: Text('Shop chưa có vật phẩm'),
                  ),
                ],
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: shopProvider.items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = shopProvider.items[index];

                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        item.iconUrl != null && item.iconUrl!.isNotEmpty
                            ? ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(
                            item.iconUrl!,
                            width: 64,
                            height: 64,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) =>
                            const Icon(Icons.inventory_2_outlined, size: 40),
                          ),
                        )
                            : const SizedBox(
                          width: 64,
                          height: 64,
                          child: Icon(Icons.inventory_2_outlined, size: 40),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.itemName,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(item.description ?? 'Không có mô tả'),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  Chip(
                                    label: Text('Gold: ${item.priceGold}'),
                                  ),
                                  Chip(
                                    label: Text('Premium: ${item.pricePremium}'),
                                  ),
                                  if (item.rarity != null)
                                    Chip(
                                      label: Text(item.rarity!),
                                    ),
                                  if (item.vipRequiredLevel != null)
                                    Chip(
                                      label: Text('VIP ${item.vipRequiredLevel}+'),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        FilledButton(
                          onPressed: shopProvider.isBuying
                              ? null
                              : () => _showBuyDialog(item),
                          child: const Text('Mua'),
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}