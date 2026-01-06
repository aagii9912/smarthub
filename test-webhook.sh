#!/bin/bash

# Facebook Messenger Webhook Test Script
# Энэ скрипт нь webhook ажиллаж байгаа эсэхийг шалгана

WEBHOOK_URL="$1"

if [ -z "$WEBHOOK_URL" ]; then
    echo "❌ Webhook URL байхгүй байна!"
    echo "Хэрэглэх: ./test-webhook.sh https://your-app.vercel.app/api/webhook"
    exit 1
fi

echo "🔍 Webhook шалгаж байна: $WEBHOOK_URL"
echo ""

# 1. Webhook Verification (GET)
echo "1️⃣ Webhook Verification тест..."
VERIFY_RESPONSE=$(curl -s "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=smarthub_verify_token_2024&hub.challenge=test123")

if [ "$VERIFY_RESPONSE" = "test123" ]; then
    echo "   ✅ Webhook verification амжилттай!"
else
    echo "   ❌ Webhook verification алдаатай: $VERIFY_RESPONSE"
fi

echo ""

# 2. Test Message (POST)
echo "2️⃣ Test мессеж илгээж байна..."

TEST_PAYLOAD='{
  "object": "page",
  "entry": [
    {
      "id": "test-page-id",
      "messaging": [
        {
          "sender": { "id": "test-user-123" },
          "message": { "text": "Сайн байна уу?" }
        }
      ]
    }
  ]
}'

POST_RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$TEST_PAYLOAD")

echo "   Хариулт: $POST_RESPONSE"

if echo "$POST_RESPONSE" | grep -q "ok"; then
    echo "   ✅ Webhook POST амжилттай!"
else
    echo "   ⚠️  Хариулт: $POST_RESPONSE"
fi

echo ""
echo "✅ Тест дууслаа!"

