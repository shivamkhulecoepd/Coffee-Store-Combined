# Bean & Brew OS Backend

Enterprise-grade backend for the Bean & Brew OS luxury coffee ecosystem.

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript 5.5+
- **Framework:** Express.js
- **Database:** PostgreSQL with Prisma ORM
- **Cache:** Redis
- **Real-time:** Socket.IO
- **Background Jobs:** BullMQ
- **Authentication:** JWT with Argon2id

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── api/
│   │   └── v1/
│   │       ├── controllers/  # Request handlers
│   │       ├── routes/       # API routes
│   │       └── middlewares/  # Express middleware
│   ├── domain/
│   │   └── services/         # Business logic
│   ├── infrastructure/
│   │   ├── database/         # Prisma client
│   │   └── cache/           # Redis services
│   ├── lib/
│   │   ├── errors.ts        # Error handling
│   │   ├── logger.ts        # Winston logger
│   │   ├── env.ts           # Environment validation
│   │   └── socket.ts        # Socket.IO setup
│   ├── app.ts               # Express app
│   └── server.ts            # Server entry point
└── tests/
    ├── unit/
    └── integration/
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 7+

### Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run dev
```

### Database Commands

```bash
# Create initial migration
npm run prisma:migrate

# Push schema to database (development)
npm run prisma:push

# Open Prisma Studio
npm run prisma:studio
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login user |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout user |
| GET | `/api/v1/auth/me` | Get current user |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products` | List products |
| GET | `/api/v1/products/:id` | Get product details |
| GET | `/api/v1/products/categories` | List categories |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/orders` | Create order |
| GET | `/api/v1/orders` | List user orders |
| GET | `/api/v1/orders/:id` | Get order details |
| PATCH | `/api/v1/orders/:id/status` | Update order status |

### Tables
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tables` | List branch tables |
| POST | `/api/v1/tables/:id/start-session` | Start table session |
| PATCH | `/api/v1/tables/:id/update-status` | Update table status |
| POST | `/api/v1/tables/:id/close-session` | Close table session |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/inventory` | Get inventory |
| PATCH | `/api/v1/admin/inventory/:id` | Update inventory |
| GET | `/api/v1/admin/kpis` | Get dashboard KPIs |
| GET | `/api/v1/admin/reports/sales` | Get sales report |

## Socket.IO Events

### Namespaces
- `/live` - Customer namespace
- `/ops` - Operations namespace (Barista/Admin)

### Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `ORDER_NEW` | Server → Client | New order placed |
| `ORDER_UPDATE` | Server → Client | Order status changed |
| `ORDER_READY` | Server → Client | Order ready for pickup |
| `TABLE_SYNC` | Server → Client | Table status changed |
| `STOCK_ALERT` | Server → Client | Low stock warning |

### Rooms
- `user_{userId}` - User-specific events
- `order_{orderId}` - Order-specific events
- `branch_{branchId}_ops` - Branch operations

## Order State Machine

```
PENDING → PAID → PREPARING → READY → SERVED
    ↓         ↓
CANCELLED  CANCELLED
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Development

```bash
# Lint code
npm run lint

# Fix lint errors
npm run lint:fix

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

See `.env.example` for all configuration options.

### Required Variables
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_ACCESS_SECRET` - JWT access token secret (min 32 chars)
- `JWT_REFRESH_SECRET` - JWT refresh token secret (min 32 chars)

## License

Proprietary - Bean & Brew OS
