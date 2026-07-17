# App Flow Document — Bean & Brew OS

## 1. User Entry & Authentication
- **Splash Screen:** Artisanal brand intro.
- **Welcome / Onboarding:** Highlights luxury features.
- **Login / Registration:** Role selection (Customer, Barista, Admin).
  - *Forgot Password Flow:* OTP verification -> New Password.

## 2. Customer Journey
- **Home Dashboard:** Personalized greetings, featured artisanal items, and loyalty points.
- **Product Discovery:**
  - **Catalog:** Live search -> Filter by Category -> Sort.
  - **Product Detail:** View specs -> Customize Brew -> Add to Cart / Wishlist.
- **Ordering & Checkout:**
  - **Cart:** Review items -> Adjust quantities.
  - **Checkout:** Select Address -> Select Payment Method -> Apply Promo.
  - **Confirmation:** Success animation -> Transmit to Barista Station.
  - **Tracking:** Real-time status (Preparing -> Ready -> Delivered).
- **Profile & Account:**
  - Manage Personal Info, Payment Methods, Order History, and Subscription.

## 3. Barista Workflow
- **Barista Dashboard:** Real-time table status grid.
- **Table Session:**
  - **Selection:** Tap table -> View Detail.
  - **Action:** Start Session -> Take Order -> Update Status (Preparing -> Ready).
  - **Billing:** Generate artisanal bill -> Close Session.
- **Operations:**
  - **Tasks:** Calibrate machines -> Check stock.
  - **Performance:** View extraction metrics and daily completion score.
  - **QR Scan:** Scan table QR to sync station data.

## 4. Admin Management
- **Admin Dashboard:** High-level KPIs (Sales, Customers, Efficiency).
- **Inventory Management:**
  - View Status -> Reorder Low Stock -> Directory of Suppliers.
- **Personnel Management:**
  - View Team Roster -> Toggle Shift Status -> Assign Roles.
- **Customer Relations:**
  - **Support Queue:** Review inquiries -> Resolve tickets.
- **Settings:** Global app configuration and system updates.

## 5. Global State Transitions
- **Inventory Sync:** Customer purchase -> Admin Inventory reduces -> Low stock alert triggered.
- **Order Sync:** Customer places order -> Barista Dashboard updates -> Tracking screen for Customer updates.
- **Loyalty Sync:** Order completion -> Reward points added to Customer Profile.
