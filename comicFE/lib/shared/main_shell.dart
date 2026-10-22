import 'package:flutter/material.dart';

import '../modules/comic/screens/comic_list_screen.dart';
import '../modules/guild/screens/guild_screen.dart';
import '../modules/notification/screens/notification_screen.dart';
import '../modules/user/screens/profile_screen.dart';
import '../modules/economy/shop/screen/shop_screen.dart';
import '../modules/ranking/screens/ranking_screen.dart';
import '../modules/game/afk/screen/afk_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int currentIndex = 0;

  final List<Widget> pages = const [
    ComicListScreen(),
    ShopScreen(),
    GuildScreen(),
    RankingScreen(),
    NotificationScreen(),
    AfkScreen(),
    ProfileScreen(),
  ];

  final List<String> titles = const [
    'Truyện',
    'Shop',
    'Guild',
    'BXH',
    'Thông báo',
    'AFK',
    'Tài khoản',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(titles[currentIndex]),
        centerTitle: true,
      ),
      body: IndexedStack(
        index: currentIndex,
        children: pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (value) {
          setState(() {
            currentIndex = value;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.menu_book_outlined),
            selectedIcon: Icon(Icons.menu_book),
            label: 'Comic',
          ),
          NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront),
            label: 'Shop',
          ),
          NavigationDestination(
            icon: Icon(Icons.groups_outlined),
            selectedIcon: Icon(Icons.groups),
            label: 'Guild',
          ),
          NavigationDestination(
            icon: Icon(Icons.emoji_events_outlined),
            selectedIcon: Icon(Icons.emoji_events),
            label: 'Rank',
          ),
          NavigationDestination(
            icon: Icon(Icons.notifications_outlined),
            selectedIcon: Icon(Icons.notifications),
            label: 'Notify',
          ),
          NavigationDestination(
            icon: Icon(Icons.bolt_outlined),
            selectedIcon: Icon(Icons.bolt),
            label: 'AFK',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'User',
          ),
        ],
      ),
    );
  }
}