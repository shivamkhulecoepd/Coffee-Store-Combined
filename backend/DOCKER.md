# Bean & Brew OS - Docker Setup Guide

A complete Docker-based development and production environment for the Bean & Brew Coffee Shop backend.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (Windows/Mac) or Docker Engine (Linux)
- [Docker Compose](https://docs.docker.com/compose/install/) (usually included with Docker Desktop)
- At least 4GB RAM allocated to Docker

## Quick Start

### 1. Clone and Setup

```bash
cd backend

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Check services are running
docker-compose ps
```

### 2. Initialize Database

```bash
# Run Prisma migrations
docker-compose exec api-dev npx prisma migrate dev --name init

# Generate Prisma client
docker-compose exec api-dev npx prisma generate

# (Optional) Seed with sample data
docker-compose exec api-dev npx prisma db seed
```

### 3. Access Services

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| API Server | http://localhost:3000 | - |
| Health Check | http://localhost:3000/api/v1/health | - |
| pgAdmin | http://localhost:5050 | admin@beanbrew.local / admin123 |
| PostgreSQL | localhost:5432 | beanbrew / beanbrew_secret |
| Redis | localhost:6379 | redis_secret |

## Docker Compose Services

### Services Overview

| Service | Image | Purpose |
|---------|-------|---------|
| `postgres` | postgres:16-alpine | Primary database |
| `redis` | redis:7-alpine | Cache & message broker |
| `pgadmin` | dpage/pgadmin4 | Database management UI |
| `api` | Built from Dockerfile | Backend REST API |
| `api-dev` | Built from Dockerfile.dev | Hot-reload development |

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Database
POSTGRES_USER=beanbrew
POSTGRES_PASSWORD=beanbrew_secret
POSTGRES_DB=beanbrew

# Redis
REDIS_PASSWORD=redis_secret

# pgAdmin
PGADMIN_EMAIL=admin@beanbrew.local
PGADMIN_PASSWORD=admin123

# JWT (IMPORTANT: Change these!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# Frontend
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```

## Common Commands

### Development Workflow

```bash
# Start all services (production-like build)
docker-compose up -d

# Start with hot-reload (recommended for development)
docker-compose up api-dev -d

# View logs
docker-compose logs -f api
docker-compose logs -f postgres

# Restart a specific service
docker-compose restart api

# Rebuild after code changes (for production container)
docker-compose build api
docker-compose up -d api
```

### Database Operations

```bash
# Run migrations
docker-compose exec api npx prisma migrate dev --name your_migration_name

# Apply migrations (production)
docker-compose exec api npx prisma migrate deploy

# Reset database
docker-compose exec api npx prisma migrate reset

# Open Prisma Studio
docker-compose exec api npx prisma studio

# Connect to PostgreSQL CLI
docker-compose exec postgres psql -U beanbrew -d beanbrew

# View database tables
docker-compose exec postgres psql -U beanbrew -d beanbrew -c "\dt"
```

### Redis Operations

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli -a redis_secret

# Monitor Redis commands
docker-compose exec redis redis-cli -a redis_secret monitor

# Flush Redis cache
docker-compose exec redis redis-cli -a redis_secret FLUSHALL
```

### Cleanup

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ destroys data!)
docker-compose down -v

# Remove all containers, volumes, and images
docker-compose down -v --rmi all

# Remove build cache
docker builder prune -a
```

## Production Deployment

### Building for Production

```bash
# Build the production image
docker-compose build api

# Run production container
docker-compose up -d api

# The production container automatically:
# 1. Runs Prisma migrations
# 2. Starts the API server
# 3. Performs health checks
```

### Production Checklist

- [ ] Change all secrets in `.env`
- [ ] Enable HTTPS/SSL
- [ ] Configure proper CORS origins
- [ ] Set up database backups
- [ ] Configure log aggregation
- [ ] Set up monitoring (Prometheus, Grafana)

### Scaling

```bash
# Scale API service
docker-compose up -d --scale api=3

# With load balancer (nginx), update docker-compose.yml
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs postgres
docker-compose logs redis

# Check resource usage
docker stats

# Restart services
docker-compose restart
```

### Database Connection Issues

```bash
# Verify postgres is healthy
docker-compose ps postgres

# Check DATABASE_URL format
# Should be: postgresql://user:password@postgres:5432/dbname

# Recreate database
docker-compose down -v
docker-compose up -d postgres
# Wait 10 seconds
docker-compose up -d api
```

### Port Conflicts

If ports are already in use:

```bash
# Check what's using the port
netstat -an | findstr "5432"
netstat -an | findstr "6379"
netstat -an | findstr "3000"

# Change ports in docker-compose.yml or .env
```

### Permission Issues (Linux)

```bash
# Fix volume permissions
sudo chown -R $USER:$USER ./uploads
sudo chmod -R 755 ./uploads
```

### Reset Everything

```bash
# Complete reset (⚠️ destroys all data!)
docker-compose down -v --remove-orphans
docker builder prune -a
docker system prune -a
docker-compose up -d
```

## File Structure

```
backend/
├── docker-compose.yml      # Main compose file
├── Dockerfile              # Production build
├── Dockerfile.dev          # Development with hot-reload
├── .dockerignore           # Build exclusions
├── docker/
│   ├── postgres/
│   │   └── init.sql        # Database initialization
│   └── pgadmin/
│       └── servers.json    # pgAdmin server config
├── uploads/                # User uploads directory
├── prisma/                 # Database schema
└── .env                    # Environment variables (create from .env.example)
```

## Health Checks

```bash
# Check API health
curl http://localhost:3000/api/v1/health

# Check all container health
docker-compose ps

# Container health status
docker inspect --format='{{.State.Health.Status}}' beanbrew-api
```

## Data Persistence

Volumes are used for data persistence:

| Volume | Purpose |
|--------|---------|
| `postgres_data` | PostgreSQL database files |
| `redis_data` | Redis persistence (AOF) |
| `pgadmin_data` | pgAdmin settings |

Data persists across container restarts but is **deleted** when using `docker-compose down -v`.

## Security Notes

- Change all default passwords in production
- Never commit `.env` to version control
- Use Docker secrets for sensitive data in swarm mode
- Regularly update base images
- Scan images for vulnerabilities: `docker scan beanbrew-api`
