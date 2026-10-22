import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app/app.dart';
import 'core/network/api_client.dart';
import 'core/storage/token_storage.dart';

import 'modules/auth/provider/auth_provider.dart';
import 'modules/auth/service/auth_service.dart';

import 'modules/user/provider/user_provider.dart';
import 'modules/user/service/user_service.dart';

import 'modules/comic/provider/comic_provider.dart';
import 'modules/comic/service/comic_service.dart';

import 'modules/guild/provider/guild_provider.dart';
import 'modules/guild/service/guild_service.dart';

import 'modules/notification/provider/notification_provider.dart';
import 'modules/notification/service/notification_service.dart';

import 'modules/economy/shop/provider/shop_provider.dart';
import 'modules/economy/shop/service/shop_service.dart';

import 'modules/ranking/provider/ranking_provider.dart';
import 'modules/ranking/service/ranking_service.dart';

import 'modules/game/afk/provider/afk_provider.dart';
import 'modules/game/afk/service/afk_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  runApp(
    MultiProvider(
      providers: [
        Provider<TokenStorage>(
          create: (_) => TokenStorage(),
        ),
        Provider<ApiClient>(
          create: (context) => ApiClient(
            tokenStorage: context.read<TokenStorage>(),
          ),
        ),

        Provider<AuthService>(
          create: (context) => AuthService(
            apiClient: context.read<ApiClient>(),
            tokenStorage: context.read<TokenStorage>(),
          ),
        ),
        Provider<UserService>(
          create: (context) => UserService(
            apiClient: context.read<ApiClient>(),
          ),
        ),
        Provider<ComicService>(
          create: (context) => ComicService(
            apiClient: context.read<ApiClient>(),
          ),
        ),
        Provider<GuildService>(
          create: (context) => GuildService(
            apiClient: context.read<ApiClient>(),
          ),
        ),
        Provider<NotificationService>(
          create: (context) => NotificationService(
            apiClient: context.read<ApiClient>(),
          ),
        ),
        Provider<ShopService>(
          create: (context) => ShopService(
            apiClient: context.read<ApiClient>(),
          ),
        ),
        Provider<RankingService>(
          create: (context) => RankingService(
            apiClient: context.read<ApiClient>(),
          ),
        ),
        Provider<AfkService>(
          create: (context) => AfkService(
            apiClient: context.read<ApiClient>(),
          ),
        ),

        ChangeNotifierProvider<AuthProvider>(
          create: (context) => AuthProvider(
            authService: context.read<AuthService>(),
          )..bootstrap(),
        ),
        ChangeNotifierProvider<UserProvider>(
          create: (context) => UserProvider(
            userService: context.read<UserService>(),
          ),
        ),
        ChangeNotifierProvider<ComicProvider>(
          create: (context) => ComicProvider(
            comicService: context.read<ComicService>(),
          ),
        ),
        ChangeNotifierProvider<GuildProvider>(
          create: (context) => GuildProvider(
            guildService: context.read<GuildService>(),
          ),
        ),
        ChangeNotifierProvider<NotificationProvider>(
          create: (context) => NotificationProvider(
            notificationService: context.read<NotificationService>(),
          ),
        ),
        ChangeNotifierProvider<ShopProvider>(
          create: (context) => ShopProvider(
            shopService: context.read<ShopService>(),
          ),
        ),
        ChangeNotifierProvider<RankingProvider>(
          create: (context) => RankingProvider(
            rankingService: context.read<RankingService>(),
          ),
        ),
        ChangeNotifierProvider<AfkProvider>(
          create: (context) => AfkProvider(
            afkService: context.read<AfkService>(),
          ),
        ),
      ],
      child: const MyApp(),
    ),
  );
}