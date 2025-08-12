# Mintpark Backend

TypeScript/Node.js backend that powers the Launchpad and Marketplace functionality, exposes public and admin APIs, and coordinates with background workers for IPFS uploads and Bitcoin inscriptions.

## Responsibilities

- Launchpad: deploy collections, configure phases (whitelist, FCFS, public), generate/verify mint signatures
- Marketplace: create, buy, cancel ERC‑721 listings; synchronize on‑chain activity from subgraph
- Asset pipeline: build images from traits, manage S3/IPFS uploads (via queue processor)
- Inter‑service APIs used by workers (API‑key protected)

## Key services

- EVM services: unsigned tx builders and helpers for Marketplace and Direct Mint NFT
- Background sync: marketplace subgraph synchronization
- Redis caching for active phase data

## Public routes (selected)

- `GET /api/v1/launchpad/...` — Launchpad operations
- `GET /api/v1/collections/...` — Collection CRUD & queries
- `GET /api/v1/collectibles/:id` — Collectible by id
- `GET /api/v1/collectibles/:collectionId/collection/listable` — Listable tokens
- `GET /api/v1/collectible-traits/...` — Collectible trait operations
- `GET /api/v1/lists/...` — Lists

Authentication varies per route: JWT bearer for user/creator/admin endpoints.

## Inter‑service routes (used by workers)

These are protected by `X-API-KEY` or `Authorization: Bearer <QUEUE_PROCESSOR_API_KEY>` according to middleware.

- Collectibles

  - `POST /api/v1/collectibles/update-ipfs` — Update a collectible with `ipfsUri` (used after IPFS upload)
  - `GET /api/v1/collectibles/service/:collectibleId` — Fetch collectible (including UNCONFIRMED)
  - `GET /api/v1/collectibles/service/:collectibleId/build-from-traits` — Build PNG from traits and return binary
  - `GET /api/v1/collectibles/count-without-parent-and-not-ooo/for-service` — Count remaining recursives
  - `GET /api/v1/collectibles/count-without-parent/for-service` — Count remaining 1-of-1
  - `GET /api/v1/collectibles/service/:collectionId/1-of-1` — Random 1-of-1 collectible
  - `GET /api/v1/collectibles/service/:collectionId/recursive` — Random recursive collectible
  - `POST /api/v1/collectibles/:collectibleId/recursive` — Create recursive collectible and set parent
  - `GET /api/v1/collectible-traits/:collectibleId/collectible-with-inscriptions` — Traits with inscriptionIds
  - Event helpers: `GET /api/v1/collectibles/service/:uniqueIdx/unique-index`, `POST /api/v1/collectibles/service/l2-only`, `PUT /api/v1/collectibles/service/:collectibleId/mark-as-burned`

- Trait Values

  - `GET /api/v1/trait-values/service/:collectionId` — Random trait value
  - `PATCH /api/v1/trait-values/service/update-inscription` — Update inscription for a trait value
  - `GET /api/v1/trait-values/service/:collectionId/not-done-count` — Remaining trait values

- Orders/Collections (used during inscription processing)
  - `GET /api/v1/orders/:id/details` — Funding address, private key, feeRate
  - `PUT /api/v1/collections/:orderId/mark-as-ran-out-of-funds` — Mark state when funds are insufficient

## Worker integration

- IPFS upload worker calls the inter‑service endpoints above to get collectible details, build images, and persist `ipfsUri`.
- Inscription worker consumes SQS events and drives the TRAIT → RECURSIVE → ONE_OF_ONE phases, calling the endpoints above to fetch inputs and persist results.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6.2+
- An EVM RPC endpoint for your target chain(s) as configured in `src/blockchain/evm/evm-config.ts`
- AWS account (S3 bucket and SQS queue)
- Pinata API access (JWT + gateway)

## Environment (.env example)

```ini
# Server
NODE_ENV=development
PORT=3001

# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mintpark
PGHOST=localhost
PGDATABASE=mintpark
PGUSER=postgres
PGPASSWORD=postgres
PGPOOL_MAX=10

# JWT
JWT_ACCESS_SECRET=access-secret
JWT_ACCESS_EXPIRATION_TIME=15m
JWT_REFRESH_SECRET=refresh-secret
JWT_REFRESH_EXPIRATION_TIME=30d

# Redis
REDIS_CONNECTION_STRING=redis://:your_redis_password@127.0.0.1:6379

# AWS (S3 + SQS)
AWS_S3_ACCESS_KEY=AKIA...
AWS_S3_SECRET_KEY=...
AWS_S3_BUCKET_NAME=your-nft-bucket
AWS_SQS_URL=https://sqs.eu-central-1.amazonaws.com/123456789012/inscription-queue
AWS_SQS_ACCESS_KEY=AKIA...
AWS_SQS_SECRET_KEY=...

# IPFS (Pinata)
PINATA_JWT=eyJhbGciOi...
PINATA_GATEWAY_URL=https://gateway.pinata.cloud

# EVM
VAULT_ADDRESS=0xYourVaultSignerAddress
VAULT_PRIVATE_KEY=your_private_key_hex
PLATFORM_FEE_RECIPIENT=0xPlatformFeeRecipient

# Worker integration
QUEUE_PROCESSOR_URL=http://localhost:4000
QUEUE_PROCESSOR_API_KEY=super-secret-shared-key

# Marketplace sync and fee recipients
MARKETPLACE_SYNC_SECRET=sync-secret
MAINNET_SERVICE_FEE_RECIPIENT_ADDRESS=0x...
TESTNET_SERVICE_FEE_RECIPIENT_ADDRESS=0x...
```

Notes:

- `QUEUE_PROCESSOR_API_KEY` must match `MAIN_APP_API_KEY` in the queue processor `.env`.
- `AWS_SQS_ACCESS_KEY` and `AWS_SQS_SECRET_KEY` must match the queue processor so both services operate on the same SQS queue/url.
- RPC URLs and marketplace addresses are configured in `src/blockchain/evm/evm-config.ts`. Use the chain that fits your setup (e.g., Hemi testnet `743111`).

## Local setup

1. Install dependencies

```bash
npm install
```

2. Start PostgreSQL and create database (example via Docker)

```bash
docker run --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:14
# wait a few seconds, then
docker exec -it pg psql -U postgres -c 'CREATE DATABASE mintpark;'
```

3. Start Redis (example via Docker)

```bash
docker run -p 6379:6379 -e REDIS_ARGS="--requirepass your_redis_password" redis:7
```

4. Apply database migrations

```bash
npm run migrate:development
```

5. Build contracts and backend, then start

```bash
npm run build
npm start
# or
npm run dev
```

## Quickstart checks

- API root

```bash
curl http://localhost:3001/
```

- Get a collectible for service (replace IDs)

```bash
curl -H "Authorization: Bearer super-secret-shared-key" \
  http://localhost:3001/api/v1/collectibles/service/c_001
```

- Build image from traits (returns image/png)

```bash
curl -H "Authorization: Bearer super-secret-shared-key" \
  -H "Accept: image/png" \
  http://localhost:3001/api/v1/collectibles/service/c_001/build-from-traits --output out.png
```

- Get trait value for inscription

```bash
curl -H "Authorization: Bearer super-secret-shared-key" \
  http://localhost:3001/api/v1/trait-values/service/col_123
```

## Chains and RPCs

- Chain settings are in `src/blockchain/evm/evm-config.ts` (e.g., Hemi, Citrea, Sepolia).
- Services instantiate `ethers.JsonRpcProvider` with `RPC_URL` from the selected chain.

## Run together (backend + queue processor)

- Start backend on `:3001` (this project)
- Start queue processor on `:4000` (`../queue-processor-service`)
- Ensure `.env` API keys match for inter‑service calls

## Scripts

- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm start` or `npm run start:prod`
- DB migrations: `npm run migrate:development|staging|production`
- Hardhat compile before build is executed automatically via `prebuild`

## Notes

- EVM contracts are versioned; mint/signature flows differ per contract version.
- Subgraph sync is started in `src/index.ts` and stored on `app.locals.marketplaceSyncService`.
- Only existing functionality is documented; endpoints above are sourced from the actual route files.
