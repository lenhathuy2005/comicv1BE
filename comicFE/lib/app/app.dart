import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../shared/main_shell.dart';
import '../modules/auth/provider/auth_provider.dart';
import '../modules/auth/screens/login_screen.dart';


class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Comic Cultivation',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.deepPurple,
      ),
      home: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          if (authProvider.isBooting) {
            return const Scaffold(
              body: Center(
                child: CircularProgressIndicator(),
              ),
            );
          }

          if (authProvider.isLoggedIn) {
            return const MainShell();
          }

          return const LoginScreen();
        },
      ),
    );
  }
}

