#!/bin/bash

# SmartHub Agent Browser Test Script
# Vercel-ийн Agent Browser ашиглан автомат тест хийх

set -e

BASE_URL="${BASE_URL:-http://localhost:3001}"
SESSION_NAME="${SESSION_NAME:-smarthub-test}"
SCREENSHOTS_DIR="./agent-browser-screenshots"

# Screenshots хадгалах хавтас үүсгэх
mkdir -p "$SCREENSHOTS_DIR"

echo "🚀 Starting Agent Browser Tests for SmartHub"
echo "📍 Base URL: $BASE_URL"
echo "📸 Screenshots: $SCREENSHOTS_DIR"
echo ""

# ===== TEST 1: Landing Page =====
echo "🧪 Test 1: Landing Page Load"
npx agent-browser open "$BASE_URL" --session "$SESSION_NAME"
sleep 2
npx agent-browser screenshot "$SCREENSHOTS_DIR/01-landing.png" --session "$SESSION_NAME"
TITLE=$(npx agent-browser get title --session "$SESSION_NAME")
echo "   ✅ Page title: $TITLE"

# ===== TEST 2: Dashboard Redirect =====
echo "🧪 Test 2: Dashboard Navigation"
npx agent-browser open "$BASE_URL/dashboard" --session "$SESSION_NAME"
sleep 2
npx agent-browser screenshot "$SCREENSHOTS_DIR/02-dashboard.png" --session "$SESSION_NAME"
CURRENT_URL=$(npx agent-browser get url --session "$SESSION_NAME")
echo "   ✅ Current URL: $CURRENT_URL"

# ===== TEST 3: Setup Page =====
echo "🧪 Test 3: Setup Page"
npx agent-browser open "$BASE_URL/setup" --session "$SESSION_NAME"
sleep 2
npx agent-browser screenshot "$SCREENSHOTS_DIR/03-setup.png" --session "$SESSION_NAME"
echo "   ✅ Setup page loaded"

# ===== TEST 4: Interactive Elements Snapshot =====
echo "🧪 Test 4: Interactive Elements Analysis"
npx agent-browser snapshot -i --session "$SESSION_NAME" > "$SCREENSHOTS_DIR/interactive-elements.txt"
echo "   ✅ Interactive elements saved to interactive-elements.txt"

# ===== TEST 5: Products Page =====
echo "🧪 Test 5: Products Page"
npx agent-browser open "$BASE_URL/dashboard/products" --session "$SESSION_NAME"
sleep 2
npx agent-browser screenshot "$SCREENSHOTS_DIR/05-products.png" --session "$SESSION_NAME"
echo "   ✅ Products page loaded"

# ===== TEST 6: Orders Page =====
echo "🧪 Test 6: Orders Page"
npx agent-browser open "$BASE_URL/dashboard/orders" --session "$SESSION_NAME"
sleep 2
npx agent-browser screenshot "$SCREENSHOTS_DIR/06-orders.png" --session "$SESSION_NAME"
echo "   ✅ Orders page loaded"

# ===== TEST 7: AI Settings Page =====
echo "🧪 Test 7: AI Settings Page"
npx agent-browser open "$BASE_URL/dashboard/ai-settings" --session "$SESSION_NAME"
sleep 2
npx agent-browser screenshot "$SCREENSHOTS_DIR/07-ai-settings.png" --session "$SESSION_NAME"
echo "   ✅ AI Settings page loaded"

# Cleanup
echo ""
echo "🧹 Closing browser..."
npx agent-browser close --session "$SESSION_NAME"

echo ""
echo "✅ All tests completed!"
echo "📸 Screenshots saved to: $SCREENSHOTS_DIR"
echo ""
ls -la "$SCREENSHOTS_DIR"
