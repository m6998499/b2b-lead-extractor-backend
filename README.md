# B2B Lead Extractor Backend

Express.js backend server for the B2B Lead Extractor Chrome Extension.

## Endpoints

- `GET /api/credits` — Get current credit balance for a user token
- `POST /api/enrich` — Enrich a LinkedIn profile (requires Bearer token)

## Running locally

```bash
npm install
npm start
```

## Deploy

Deployed on Fly.io. Uses `process.env.PORT` automatically.
