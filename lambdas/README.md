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
