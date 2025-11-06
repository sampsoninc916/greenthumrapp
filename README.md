# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Automated QA testing

End-to-end QA for critical marketplace flows is covered with Vitest. The suite validates data normalization logic for plant listings and the email service orchestration used by the waitlist and lifecycle campaigns.

1. Install dependencies (includes dev dependencies required for testing):

   ```bash
   npm install
   ```

2. Run the full automated QA suite:

   ```bash
   npm test
   ```

   The command executes all `*.test.ts` files under `src/` and will fail fast if any regression is detected.

3. To execute or debug a single spec file, pass its path to Vitest:

   ```bash
   npx vitest run src/services/__tests__/email.test.ts
   ```

## Deploying to Cloudflare Workers

This branch includes configuration for deploying the built site to a [Cloudflare Worker](https://developers.cloudflare.com/workers/).

1. Install dependencies (Wrangler is included as a dev dependency):

   ```bash
   npm install
   ```

2. Start a local worker that serves the production build:

   ```bash
   npm run worker:dev
   ```

3. Deploy to your Cloudflare development environment:

   ```bash
   npm run worker:deploy
   ```

   Ensure you have run `wrangler login` and configured the desired account.

The worker serves static assets from the `dist/` directory and falls back to `index.html` for SPA routes.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

# Thumr Lambda Functions

This directory houses standalone AWS Lambda handlers for the marketplace backend. Each function is written in Node.js (ES modules) so you can copy the source into an AWS Lambda function without additional build tooling. Shared utilities live in `lambdas/common`.

## Directory overview

| Path | Purpose |
| --- | --- |
| `common/` | Shared helpers for auth, DynamoDB, S3, logging, and email. |
| `plants/` | Handlers for listing retrieval, creation, and updates. |
| `uploads/` | Presigned URL generation, malware scan callbacks, and cleanup jobs. |
| `users/` | User profile CRUD handlers. |
| `messages/` | Messaging thread operations and unread counters. |
| `reviews/` | Buyer review submission and seller rating summaries. |
| `admin/` | Admin dashboards for users, listings, disputes, and audit logging. |
| `email/` | Marketing and lifecycle email subscription endpoints. |
| `payments/` | Stripe-based charge workflow. |

## Environment variables

Each function expects the following environment variables (configure per Lambda):

- `AWS_REGION` – AWS region for DynamoDB, S3, SES, and Cognito
- `COGNITO_USER_POOL_ID`, `COGNITO_APP_CLIENT_ID` – Cognito details used by `verifyAuth`
- `SERVICE_NAME` – Optional log enrichment identifier
- `CORS_ALLOW_ORIGIN` – Allowed origin for API responses
- `PLANTS_TABLE`, `USERS_TABLE`, `UPLOADS_TABLE`, `THREADS_TABLE`, `MESSAGES_TABLE`, `REVIEWS_TABLE`, `SELLER_METRICS_TABLE`, `ORDERS_TABLE`, `DISPUTES_TABLE`, `AUDIT_TABLE`, `TRANSACTIONS_TABLE`, `EMAIL_CONSENTS_TABLE` – DynamoDB table names
- `REVIEWS_SELLER_INDEX` – Name of the GSI used to fetch reviews by seller (defaults to `SellerIdIndex`)
- `UPLOADS_BUCKET`, `PLANT_IMAGES_BUCKET` – S3 buckets used for media storage
- `UPLOAD_URL_TTL`, `UPLOAD_RECORD_TTL`, `UPLOAD_MAX_BYTES` – Upload configuration values
- `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE` – Optional overrides for S3-compatible services
- `EMAIL_SOURCE_ADDRESS` – Verified SES sender for email functions
- `STRIPE_SECRET_KEY` – Stripe secret key used by the payments handler

Configure role-based access with IAM policies that restrict each function to the tables, buckets, and services it needs.

## Deployment guidance

1. Create a Lambda layer that packages `lambdas/common/` utilities or copy the shared helpers into each function bundle.
2. Install runtime dependencies (`@aws-sdk/*`, `aws-jwt-verify`, `stripe`) in the Lambda environment or bundle them with the handler code.
3. Wire API Gateway routes (or EventBridge schedules) to the relevant handlers. For example:
   - `GET /plants` → `plants/getPlants.handler`
   - `POST /plants` → `plants/createPlant.handler`
   - `PATCH /plants/{id}` → `plants/updatePlant.handler`
   - `POST /uploads/presign` → `uploads/createPresignUrl.handler`
   - `POST /uploads/scan` → `uploads/scanUpload.handler`
   - `POST /uploads/cleanup` → scheduled invocation of `uploads/cleanupUploads.handler`
   - `GET /users/me` → `users/getCurrentUser.handler`
   - `POST /users` → `users/createUser.handler`
   - `PATCH /users/me` → `users/updateCurrentUser.handler`
   - `POST /messages/threads` → `messages/createThread.handler`
   - `POST /messages/send` → `messages/sendMessage.handler`
   - `POST /messages/read` → `messages/markRead.handler`
   - `GET /messages/unread-count` → `messages/getUnreadCount.handler`
   - `POST /reviews` → `reviews/submitReview.handler`
   - `GET /reviews/summary` → `reviews/getReviewSummary.handler`
   - `GET|POST /admin/users` → `admin/usersHandler.handler`
   - `GET|POST /admin/listings` → `admin/listingsHandler.handler`
   - `GET|POST /admin/disputes` → `admin/disputesHandler.handler`
   - `POST /admin/audit` → `admin/createAuditEvent.handler`
   - `POST /email/subscribe` → `email/subscribe.handler`
   - `POST /email/unsubscribe` → `email/unsubscribe.handler`
   - `POST /email/lifecycle` → `email/triggerLifecycle.handler`
   - `POST /email/templates-sync` → `email/templatesSync.handler`
   - `POST /email/consent` → `email/updateConsent.handler`
   - `POST /payments/charge` → `payments/createCharge.handler`
4. Configure CloudWatch alarms and DLQs per function for resiliency.

These handlers encapsulate the expected Thumr marketplace features so you can paste them directly into the AWS Lambda console or deploy them through your preferred IaC pipeline.
