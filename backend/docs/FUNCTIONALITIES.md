# Comprehensive Functionalities Guide — Bean & Brew OS

This document provides an exhaustive, screen-by-screen and feature-by-feature breakdown of the Bean & Brew OS application. It serves as the definitive functional reference for developers, testers, and stakeholders.

---

## 1. Authentication & Identity Management

### 1.1 Splash Screen
- **Visual:** Animated logo and brand reveal.
- **Logic:** Checks for existing session; routes to Onboarding if first run, Login if not authenticated, or Dashboard if authenticated.

### 1.2 Onboarding Experience
- **Interactive Slides:** Multi-page artisanal slider explaining Customer, Barista, and Admin value propositions.
- **Action:** Direct entry to login/registration or role selection.

### 1.3 User Authentication Flow
- **Login Screen:**
  - Email and Password fields with real-time Zod-style validation.
  - Biometric Login toggle (FaceID/Fingerprint).
  - Forgot Password entry link.
- **Registration Screen:**
  - Full Name, Email, Password, and Role Selection.
  - Role selection triggers different profile initialization logic in the backend.
- **Forgot Password Flow:**
  - Email request screen.
  - OTP Verification screen (6-digit masked input).
  - New Password creation screen with complexity indicators.

---

## 2. Customer Module (The Connoisseur Experience)

### 2.1 Unified Home Dashboard
- **Personalized Header:** Dynamic greeting based on time of day and user name.
- **Loyalty Snapshot:** Visual "Bean Points" counter and current membership tier (Gold/Silver/Bronze).
- **Featured Artisanal Carousel:** Horizontal scroll of high-priority seasonal items.
- **Quick Actions:** Shortcuts to "Order Now", "My Favorites", and "Subscriptions".

### 2.2 Artisanal Catalog & Discovery
- **Live Search Bar:** Debounced search against product names and descriptions.
- **Category Filter (Chips):** Horizontal scrolling chips for "Espresso", "Cold Brew", "Beans", "Pastry".
- **Sorting Engine:** Modal bottom-sheet for sorting by "Price (Low to High)", "Rating (High to Low)", "Name (A-Z)".
- **Layout Toggle:** Switch between high-impact feature cards and efficient list views.

### 2.3 Product Intelligence & Customization
- **Immersive Detail Page:** Large-scale product imagery with "Luxury Modern" frosted overlays.
- **Brew Specifications:** Tabbed interface for "Tasting Notes", "Origin Data", and "Roast Profile".
- **Customization Engine:**
  - **Milk Selection:** Radio options (Oat, Whole, Soy, Almond) with associated price deltas.
  - **Syrup Add-ons:** Multiple selection (Vanilla, Caramel, Hazelnut).
  - **Shot Adjustments:** Stepper for extra espresso shots.
- **Wishlist Integration:** Hero-animated heart button to add to "Curated List".

### 2.4 Cart & Checkout Orchestration
- **Smart Cart:**
  - List of items with specific customization summaries.
  - Quantity adjustment with real-time subtotal updates.
  - "Clear Cart" and "Add More" interactions.
- **Checkout Flow:**
  - **Address Selection:** Choose from stored locations or add new via modal.
  - **Payment Selection:** Secure selection of saved cards or digital wallets.
  - **Promotion Logic:** Input field for artisanal discount codes with instant validation.
  - **Order Summary:** Breakdown of Subtotal, Artisanal Tax, and Delivery/Service fees.
- **Order Confirmation:** "Luxury" success animation and "Track Order" call-to-action.

### 2.5 Post-Order Operations
- **Order Tracking:**
  - Real-time status timeline (Order Placed -> Preparing -> Out for Delivery -> Delivered).
  - Live map integration (mock) for delivery tracking.
- **Order History:**
  - Itemized list of all past transactions.
  - "Reorder" button to instantly clone a previous artisanal configuration to the cart.

---

## 3. Barista Module (Operations Control)

### 3.1 Table Management System
- **Real-time Table Grid:** Visual representation of the shop floor with dynamic status coloring (Green = Vacant, Orange = Occupied, Blue = Billing).
- **Table Session Detail:**
  - Active order list for the specific table.
  - **Status Management:** Dropdown to manually override table state.
  - **Artisanal Billing:** "Generate Bill" action that calculates the final total including session duration fees (if applicable).
  - **Session Closure:** Atomic operation to clear table and sync data to Admin reports.

### 3.2 Brewing & Extraction Workflow
- **Order Queue:** Centralized list of pending beverages sorted by priority and order time.
- **Task Management:**
  - **Machine Calibration:** Checklists for espresso machine pressure and grinder settings.
  - **Quality Control:** Actionable tasks for station cleaning and bean hopper refills.
- **Shot Timer:** Integrated digital timer with start/stop/reset for monitoring extraction precision.

### 3.3 Barista Performance & Metrics
- **Performance Dashboard:** Daily stats for "Total Orders Completed", "Average Extraction Time", and "Customer Satisfaction Rating".
- **Shift Handover:** Digital report generation for the incoming shift.

---

## 4. Administrative Module (Enterprise Oversight)

### 4.1 Executive Dashboard
- **KPI Visualization:** Large "Luxury" KPI cards for Revenue, New Customers, and Operational Efficiency.
- **Trend Analysis:** Interactive sparkline charts showing order volume trends over 24 hours.

### 4.2 Supply Chain & Inventory
- **Inventory Status:** Real-time stock levels with unit-based tracking (kg, Liters, Units).
- **Automated Alerts:** Low-stock visual triggers (Orange < 30%, Red < 10%).
- **Supplier Directory:** Contact database for artisanal suppliers with direct "Call/Email" integration.
- **Purchase Order System:** Wizard to generate and transmit restock requests based on current deficits.

### 4.3 Personnel & Roster Management
- **Team Roster:** Active list of employees with current shift status (ON/OFF).
- **Role Control:** Interface to promote Junior Baristas or assign Lead roles.
- **Performance Monitoring:** Deep-dive into individual barista efficiency metrics.

### 4.4 Customer Relations (Support)
- **Request Queue:** Centralized inbox for subscription inquiries, table reservations, and feedback.
- **Ticket Resolution:** Ability to mark requests as "Resolved" or "Escalated".

---

## 5. Loyalty, Rewards & Subscriptions

### 5.1 Loyalty Engine
- **Points Ledger:** Detailed history of points earned and spent.
- **Tier Progression:** Progress bar showing distance to the next membership level.
- **Reward Store:** Catalog of claimable artisanal items using accumulated points.

### 5.2 Subscription Management
- **Plan Selection:** Compare "Daily Brew", "Weekend Connoisseur", and "Unlimited" plans.
- **Billing Management:** View next billing date, payment method, and plan benefits.

---

## 6. System Architecture & Cross-Cutting Concerns

### 6.1 Real-time Synchronization (Centralized State)
- **Repository Pattern:** All modules (Customer, Barista, Admin) utilize a shared `StoreRepository`.
- **Event Propagation:** State changes in one module (e.g., Table status change by Barista) reflect instantly in others (Customer's table view) via Stream-based architecture.

### 6.2 Responsiveness & Adaptability
- **Resolution Scaling:** Full `flutter_screenutil` implementation ensuring identical proportions on 5" phones vs 12" tablets.
- **Thematic Consistency:** Persistent "Luxury Modern" dark theme with Glassmorphism applied globally.

### 6.3 Notification Center
- **Order Alerts:** Push notifications for status changes.
- **Inventory Alerts:** System alerts for administrators.
- **Marketing Alerts:** Promotional notifications for reward members.
