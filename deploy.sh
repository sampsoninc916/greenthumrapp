#!/bin/bash
# Deploy script for dpw-creative-2025 to iDrive e2 with correct MIME types

# ---- CONFIG ----
BUCKET="dev.thumr.com"
ENDPOINT="https://m0j7.va11.idrivee2-5.com"  # e.g. https://fly.idrivee2-23.com
DIST_DIR="dist"

# ---- AWS CONFIG ----
# These values should be exported in your shell environment before running deploy.sh
#   export AWS_ACCESS_KEY_ID="your-access-key"
#   export AWS_SECRET_ACCESS_KEY="your-secret-key"
#   export AWS_DEFAULT_REGION="us-east-1"
#
# The script will pick them up automatically, but to be safe, we can explicitly set them:
aws configure set aws_access_key_id "bNMEGwonoSu4rHdbpGln"
aws configure set aws_secret_access_key "WBfueMx8os9m51bfV2aqwmsn4mVhEZnk2sog3KjG"
aws configure set default.region "us-east-1"

# ---- BUILD ----
echo "Building Vite app..."
npm run build

# ---- UPLOAD ----
echo "Uploading index.html..."
aws s3 cp $DIST_DIR/index.html s3://$BUCKET/ \
  --endpoint-url=$ENDPOINT \
  --content-type "text/html" --acl public-read

echo "Uploading CSS..."
aws s3 cp $DIST_DIR/ s3://$BUCKET/ \
  --recursive --exclude "*" --include "*.css" \
  --endpoint-url=$ENDPOINT \
  --content-type "text/css" --acl public-read

echo "Uploading JS..."
aws s3 cp $DIST_DIR/ s3://$BUCKET/ \
  --recursive --exclude "*" --include "*.js" \
  --endpoint-url=$ENDPOINT \
  --content-type "application/javascript" --acl public-read

echo "Uploading other assets..."
aws s3 cp $DIST_DIR/ s3://$BUCKET/ \
  --recursive --exclude "*.html" --exclude "*.css" --exclude "*.js" \
  --endpoint-url=$ENDPOINT --acl public-read

echo "✅ Deploy complete! Don’t forget Cloudflare SPA routing (fallback to index.html)."