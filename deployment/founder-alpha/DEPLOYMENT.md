# Founder Alpha Deployment Guide

## Prerequisites
- Node.js 20+
- MySQL 8.0+
- Git

## Installation
```bash
npm install
npm run db:push
npm run build
npm start
```

## Environment
Copy `.env.example` to `.env` and configure all required variables.

## Verification
Run all 17 verification checks via API after deployment.

## Deployment Timeline
1. Archive existing data (see `archive/pre-alpha/`)
2. Reset test data
3. Deploy Model Gateway + Tool Gateway
4. Deploy Constitutional Extensions
5. Verify all 17 checks
6. Execute 3 Founder Alpha cycles
7. Generate final certification
