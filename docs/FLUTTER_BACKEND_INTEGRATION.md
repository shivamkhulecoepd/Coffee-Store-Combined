# Bean & Brew - Flutter & Backend Integration Guide

## Overview

This document outlines the complete integration plan between the Flutter mobile app and Node.js backend for the Bean & Brew luxury coffee ecosystem.

---

## Architecture Summary

```
┌─────────────────────┐         ┌─────────────────────┐
│   Flutter Mobile    │   HTTP   │    Node.js API       │
│       App          │◄───────►│    (Port 3000)      │
│                     │         │                     │
│  • Auth Repository  │         │  • Auth Controller   │
│  • API Service     │         │  • Product Routes   │
│  • BLoC Pattern  │         │  • Order Routes      │
│                     │         │  • Admin Routes     │
└─────────┬───────────┘         └──────────┬──────────┘
          │                                │
          │         ┌─────────────────────┼─────────────────────┐
          │         │                     │                     │
          │    ┌────▼────┐          ┌─────▼─────┐        ┌─────▼─────┐
          │    │PostgreSQL│          │   Redis   │        │ Socket.IO │
          │    │(Docker)  │          │  (Cache)  │        │(Real-time)│
          │    └─────────┘          └───────────┘        └───────────┘
          └────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation & Authentication (Priority: HIGH)

### Goals
- Replace mock auth with real API calls
- Implement JWT token management
- Create proper API service with Dio
- Update Flutter models to match backend

### Tasks

#### 1.1 Create Proper API Service
**File:** `lib/services/api_service.dart`

```dart
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  late final Dio _dio;
  final String baseUrl;

  ApiService({required this.baseUrl}) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    // Add interceptors
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Try to refresh token
          final refreshed = await _refreshToken();
          if (refreshed) {
            // Retry request
            final opts = error.requestOptions;
            final token = await _getToken();
            opts.headers['Authorization'] = 'Bearer $token';
            final response = await _dio.fetch(opts);
            return handler.resolve(response);
          }
        }
        handler.next(error);
      },
    ));
  }

  Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token');
  }

  Future<bool> _refreshToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final refreshToken = prefs.getString('refresh_token');
      if (refreshToken == null) return false;

      final response = await Dio().post(
        '$baseUrl/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      if (response.statusCode == 200) {
        await prefs.setString('access_token', response.data['data']['accessToken']);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // HTTP Methods
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) async {
    return _dio.get(path, queryParameters: queryParameters);
  }

  Future<Response> post(String path, {dynamic data}) async {
    return _dio.post(path, data: data);
  }

  Future<Response> patch(String path, {dynamic data}) async {
    return _dio.patch(path, data: data);
  }

  Future<Response> delete(String path) async {
    return _dio.delete(path);
  }
}
```

#### 1.2 Update User Model
**File:** `lib/features/auth/models/user_model.dart`

```dart
import 'package:equatable/equatable.dart';

enum UserRole {
  customer,
  barista,
  manager,
  admin,
  superAdmin;

  String get apiValue {
    switch (this) {
      case UserRole.customer: return 'CUSTOMER';
      case UserRole.barista: return 'BARISTA';
      case UserRole.manager: return 'MANAGER';
      case UserRole.admin: return 'ADMIN';
      case UserRole.superAdmin: return 'SUPER_ADMIN';
    }
  }

  static UserRole fromString(String role) {
    switch (role) {
      case 'CUSTOMER': return UserRole.customer;
      case 'BARISTA': return UserRole.barista;
      case 'MANAGER': return UserRole.manager;
      case 'ADMIN': return UserRole.admin;
      case 'SUPER_ADMIN': return UserRole.superAdmin;
      default: return UserRole.customer;
    }
  }
}

class User extends Equatable {
  final String id;
  final String email;
  final String? name;
  final UserRole role;
  final Profile? profile;
  final String? token;

  const User({
    required this.id,
    required this.email,
    this.name,
    required this.role,
    this.profile,
    this.token,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      name: json['profile']?['firstName'] != null
          ? '${json['profile']['firstName']} ${json['profile']['lastName']}'
          : null,
      role: UserRole.fromString(json['role'] ?? 'CUSTOMER'),
      profile: json['profile'] != null
          ? Profile.fromJson(json['profile'])
          : null,
    );
  }

  @override
  List<Object?> get props => [id, email, role];
}

class Profile extends Equatable {
  final String id;
  final String firstName;
  final String lastName;
  final String? phone;
  final int loyaltyPoints;
  final String tier;

  const Profile({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.phone,
    required this.loyaltyPoints,
    required this.tier,
  });

  factory Profile.fromJson(Map<String, dynamic> json) {
    return Profile(
      id: json['id'] ?? '',
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      phone: json['phone'],
      loyaltyPoints: json['loyaltyPoints'] ?? 0,
      tier: json['tier'] ?? 'BRONZE',
    );
  }

  @override
  List<Object?> get props => [id, firstName, lastName, loyaltyPoints];
}
```

#### 1.3 Create Auth Repository with Real API
**File:** `lib/features/auth/repositories/auth_repository.dart`

```dart
import 'dart:async';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../../../services/api_service.dart';

class AuthRepository {
  final ApiService _apiService;
  User? _currentUser;
  String? _accessToken;

  AuthRepository(this._apiService);

  User? get currentUser => _currentUser;
  String? get token => _accessToken;
  bool get isAuthenticated => _currentUser != null;

  final StreamController<User?> _authStateController = StreamController<User?>.broadcast();
  Stream<User?> get authStateStream => _authStateController.stream;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString('access_token');
    _currentUser = prefs.getString('user_id') != null ? User(
      id: prefs.getString('user_id')!,
      email: prefs.getString('user_email') ?? '',
      name: prefs.getString('user_name'),
      role: UserRole.fromString(prefs.getString('user_role') ?? 'CUSTOMER'),
    ) : null;
    _authStateController.add(_currentUser);
  }

  Future<User> login({required String email, required String password}) async {
    try {
      final response = await _apiService.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      final data = response.data['data'];
      _accessToken = data['tokens']['accessToken'];
      final refreshToken = data['tokens']['refreshToken'];
      final user = User.fromJson(data['user']);

      // Save tokens
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('access_token', _accessToken!);
      await prefs.setString('refresh_token', refreshToken);
      await prefs.setString('user_id', user.id);
      await prefs.setString('user_email', user.email);
      await prefs.setString('user_role', user.role.apiValue);
      if (user.name != null) {
        await prefs.setString('user_name', user.name!);
      }

      _currentUser = user;
      _authStateController.add(_currentUser);
      return _currentUser!;
    } catch (e) {
      rethrow;
    }
  }

  Future<User> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
  }) async {
    try {
      final response = await _apiService.post('/auth/register', data: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        'phone': phone,
        'role': 'CUSTOMER',
      });

      final data = response.data['data'];
      _accessToken = data['tokens']?['accessToken'];
      final user = User.fromJson(data['user']);

      if (_accessToken != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('access_token', _accessToken!);
      }

      _currentUser = user;
      _authStateController.add(_currentUser);
      return _currentUser!;
    } catch (e) {
      rethrow;
    }
  }

  Future<void> logout() async {
    try {
      await _apiService.post('/auth/logout');
    } catch (e) {
      // Continue with local logout even if API fails
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    await prefs.remove('user_id');

    _accessToken = null;
    _currentUser = null;
    _authStateController.add(null);
  }

  Future<void> sendOtp({required String email}) async {
    await _apiService.post('/auth/forgot-password', data: {'email': email});
  }

  Future<bool> verifyOtp({
    required String email,
    required String code,
    String? newPassword,
  }) async {
    try {
      await _apiService.post('/auth/verify-otp', data: {
        'email': email,
        'code': code,
        'type': 'PASSWORD_RESET',
        if (newPassword != null) 'newPassword': newPassword,
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<User?> getCurrentUser() async {
    if (_accessToken == null) return null;

    try {
      final response = await _apiService.get('/auth/me');
      _currentUser = User.fromJson(response.data['data']['user']);
      _authStateController.add(_currentUser);
      return _currentUser;
    } catch (e) {
      return null;
    }
  }

  void dispose() {
    _authStateController.close();
  }
}
```

#### 1.4 Update Service Locator
**File:** `lib/core/utils/service_locator.dart`

```dart
import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../features/auth/repositories/auth_repository.dart';
// Import other repositories as they are created

final getIt = GetIt.instance;

Future<void> setupServiceLocator() async {
  // SharedPreferences
  final prefs = await SharedPreferences.getInstance();
  getIt.registerSingleton<SharedPreferences>(prefs);

  // API Service
  // For local development: http://10.0.2.2:3000 (Android emulator)
  // For iOS simulator: http://localhost:3000
  // For real device: use your machine's IP address
  getIt.registerSingleton<ApiService>(
    ApiService(baseUrl: 'http://10.0.2.2:3000/api/v1'),
  );

  // Repositories
  getIt.registerSingleton<AuthRepository>(
    AuthRepository(getIt<ApiService>()),
  );

  // Initialize auth state
  await getIt<AuthRepository>().init();
}
```

---

## Phase 2: Products & Catalog (Priority: HIGH)

### Goals
- Fetch products from backend
- Display categories
- Product details page
- Search functionality

### Tasks

#### 2.1 Create Product Repository
**File:** `lib/features/ordering/repositories/product_repository.dart`

```dart
import 'package:equatable/equatable.dart';
import '../../../services/api_service.dart';

class Product extends Equatable {
  final String id;
  final String name;
  final String description;
  final double basePrice;
  final String? imageUrl;
  final String? heroTag;
  final double rating;
  final int ratingCount;
  final int preparationTime;
  final bool isFeatured;
  final bool isAvailable;
  final String categoryId;
  final String categoryName;

  const Product({
    required this.id,
    required this.name,
    required this.description,
    required this.basePrice,
    this.imageUrl,
    this.heroTag,
    this.rating = 0,
    this.ratingCount = 0,
    this.preparationTime = 5,
    this.isFeatured = false,
    this.isAvailable = true,
    required this.categoryId,
    required this.categoryName,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'],
      name: json['name'],
      description: json['description'] ?? '',
      basePrice: double.parse(json['basePrice'].toString()),
      imageUrl: json['imageUrl'],
      heroTag: json['heroTag'],
      rating: (json['rating'] ?? 0).toDouble(),
      ratingCount: json['ratingCount'] ?? 0,
      preparationTime: json['preparationTime'] ?? 5,
      isFeatured: json['isFeatured'] ?? false,
      isAvailable: json['isAvailable'] ?? true,
      categoryId: json['category']?['id'] ?? '',
      categoryName: json['category']?['name'] ?? '',
    );
  }

  @override
  List<Object?> get props => [id, name, basePrice];
}

class Category extends Equatable {
  final String id;
  final String name;
  final String slug;
  final String? description;
  final String? imageUrl;
  final int sortOrder;
  final int productCount;

  const Category({
    required this.id,
    required this.name,
    required this.slug,
    this.description,
    this.imageUrl,
    this.sortOrder = 0,
    this.productCount = 0,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'],
      name: json['name'],
      slug: json['slug'],
      description: json['description'],
      imageUrl: json['imageUrl'],
      sortOrder: json['sortOrder'] ?? 0,
      productCount: json['_count']?['products'] ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, name, slug];
}

class ProductRepository {
  final ApiService _apiService;

  ProductRepository(this._apiService);

  Future<List<Product>> getProducts({
    String? categoryId,
    String? search,
    int page = 1,
    int limit = 20,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
    };
    if (categoryId != null) queryParams['category'] = categoryId;
    if (search != null) queryParams['search'] = search;

    final response = await _apiService.get('/products', queryParameters: queryParams);
    final products = (response.data['data']['products'] as List)
        .map((p) => Product.fromJson(p))
        .toList();
    return products;
  }

  Future<List<Category>> getCategories() async {
    final response = await _apiService.get('/products/categories');
    final categories = (response.data['data'] as List)
        .map((c) => Category.fromJson(c))
        .toList();
    return categories;
  }

  Future<Product> getProductById(String id) async {
    final response = await _apiService.get('/products/$id');
    return Product.fromJson(response.data['data']);
  }

  Future<List<Product>> getFeaturedProducts() async {
    final products = await getProducts();
    return products.where((p) => p.isFeatured).toList();
  }
}
```

#### 2.2 Update Product Model for Cart
**File:** `lib/features/ordering/models/product_model.dart`

```dart
import 'package:equatable/equatable.dart';
import '../../ordering/repositories/product_repository.dart';

class CartItem extends Equatable {
  final Product product;
  final int quantity;
  final String? customization;

  const CartItem({
    required this.product,
    this.quantity = 1,
    this.customization,
  });

  double get subtotal => product.basePrice * quantity;

  CartItem copyWith({Product? product, int? quantity, String? customization}) {
    return CartItem(
      product: product ?? this.product,
      quantity: quantity ?? this.quantity,
      customization: customization ?? this.customization,
    );
  }

  Map<String, dynamic> toJson() => {
        'productId': product.id,
        'quantity': quantity,
        if (customization != null) 'customization': customization,
      };

  @override
  List<Object?> get props => [product, quantity, customization];
}
```

---

## Phase 3: Orders & Cart (Priority: HIGH)

### Goals
- Cart management
- Order placement
- Order status tracking

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /orders | Create new order |
| GET | /orders | List user's orders |
| GET | /orders/:id | Get order details |
| PATCH | /orders/:id/status | Update order status (staff only) |

---

## Phase 4: Barista & Admin Features (Priority: MEDIUM)

### Goals
- Barista task management
- Admin dashboard
- Inventory management

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/kpis | Dashboard KPIs |
| GET | /admin/inventory | List inventory |
| PATCH | /admin/inventory/:id | Update inventory |
| GET | /admin/employees | List employees |
| POST | /tables/:id/start-session | Start table session |
| POST | /tables/:id/close-session | Close table session |

---

## Phase 5: Real-time Features (Priority: MEDIUM)

### Goals
- Socket.IO integration
- Real-time order updates
- Push notifications

### Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| ORDER_NEW | Server → Client | New order created |
| ORDER_UPDATE | Server → Client | Order status changed |
| ORDER_READY | Server → Client | Order ready for pickup |
| TASK_STARTED | Server → Client | Barista started task |
| TASK_COMPLETED | Server → Client | Task completed |

---

## Quick Reference: API Base URL

For development:

| Platform | URL |
|----------|-----|
| Android Emulator | `http://10.0.2.2:3000/api/v1` |
| iOS Simulator | `http://localhost:3000/api/v1` |
| Web (localhost) | `http://localhost:3000/api/v1` |
| Docker | `http://localhost:3000/api/v1` |

---

## Testing Checklist

- [ ] User registration works
- [ ] Login/logout works
- [ ] Token refresh works
- [ ] Products load correctly
- [ ] Cart operations work
- [ ] Order placement works
- [ ] Order status updates
- [ ] Barista dashboard loads
- [ ] Admin features work
