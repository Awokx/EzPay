# EzPay Architecture Overview

This document provides deep technical details about EzPay's system design. For project overview, see [README.md](README.md). For development setup, see [DEVELOPMENT.md](DEVELOPMENT.md).

## System Design Decisions

### Why Three-Tier Architecture
- **Separation of concerns**: Frontend handles UI, backend handles business logic, smart contract handles on-chain state
- **Scalability**: Each tier can scale independently
- **Security**: Smart contract provides immutable on-chain logic, backend provides off-chain data persistence

### Why Rust for Backend
- **Performance**: Zero-cost abstractions, memory safety
- **Concurrency**: Tokio async runtime for high-throughput API
- **Type safety**: Compile-time error prevention

### Why Soroban for Smart Contract
- **Stellar integration**: Native to Stellar network
- **WASM-based**: Portable, efficient execution
- **Developer experience**: Rust-based, familiar toolchain

## Module Interactions

### Frontend → Backend Communication
```
Frontend (React Query)
    ↓ HTTP/REST
Backend (Axum Router)
    ↓ Middleware (Auth, Rate Limit)
    ↓ Route Handler
    ↓ Business Logic
    ↓ Database (SQLx)
PostgreSQL
```

### Backend → Smart Contract Communication
```
Backend (Stellar SDK)
    ↓ Transaction Signing
Stellar Network (Horizon API)
    ↓ Transaction Submission
Smart Contract (Soroban)
    ↓ State Update
Stellar Ledger
```

## Data Persistence Strategy

### On-Chain Data (Smart Contract)
- Merchant registration status
- Payment request creation
- Fee configuration
- Admin controls

### Off-Chain Data (PostgreSQL)
- Merchant profiles (name, wallet, payout method)
- Payment history (amount, status, timestamps)
- Transaction metadata
- Analytics data

### Synchronization Strategy
- Smart contract emits events for state changes
- Backend polls Soroban RPC `getEvents` filtered by the EzPay contract ID
- PostgreSQL persists event IDs and an RPC cursor for replay and idempotency
- Backend updates PostgreSQL to reflect on-chain state
- Frontend queries backend for combined on-chain/off-chain data

## Security Architecture

### Authentication Flow (To Be Implemented)
```
Client Request
    ↓ JWT Token
Auth Middleware
    ↓ Token Validation
Backend Handler
    ↓ User Context
Business Logic
```

### Rate Limiting Strategy (To Be Implemented)
- IP-based rate limiting for public endpoints
- User-based rate limiting for authenticated endpoints
- Token bucket algorithm for burst handling
- Redis-backed for distributed rate limiting

### Input Validation
- Frontend: React Hook Form with Zod validation
- Backend: Serde deserialization with custom validators
- Smart Contract: Soroban type validation

## Error Handling Strategy

### Frontend Error Handling
- React Query error boundaries
- Global error context
- User-friendly error messages

### Backend Error Handling
- Custom AppError enum
- HTTP status code mapping
- Structured error responses
- Logging with tracing

### Smart Contract Error Handling
- Custom error types
- Revert on invalid operations
- Error codes for client handling

## Performance Optimization

### Database Optimization
- Connection pooling (deadpool-postgres)
- Indexed queries on frequently accessed columns
- Prepared statements via SQLx
- Read replicas for scaling (to be added)

### API Optimization
- Async I/O with Tokio
- Response compression (tower-http)
- CORS configuration
- Static asset caching

### Frontend Optimization
- Next.js static generation
- React Query caching
- Code splitting
- Image optimization

## Deployment Architecture

### Local Development
- Docker Compose for all services
- PostgreSQL container
- Backend container
- Frontend container
- Shared network for inter-service communication

### Production (To Be Implemented)
- Kubernetes for orchestration
- Horizontal pod autoscaling
- Load balancer for API
- CDN for frontend assets
- Managed PostgreSQL (e.g., AWS RDS)
