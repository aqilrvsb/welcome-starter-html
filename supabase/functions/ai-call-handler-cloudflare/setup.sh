#!/bin/bash

# Enterprise Cloudflare Workers Setup Script
# This script automates the entire deployment process

set -e

echo "=================================================="
echo "  AI Call Handler - Cloudflare Workers Setup"
echo "  Enterprise Edition"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler CLI not found${NC}"
    echo "Installing wrangler globally..."
    npm install -g wrangler
fi

# Check if logged into Cloudflare
echo -e "${BLUE}Checking Cloudflare authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}Please login to Cloudflare:${NC}"
    wrangler login
fi

# Install dependencies
echo -e "${BLUE}Installing dependencies...${NC}"
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
    echo -e "${YELLOW}Please edit .env and fill in your API keys before continuing${NC}"
    read -p "Press Enter when you've updated .env..."
fi

# Source .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Create KV namespaces
echo -e "${BLUE}Creating KV namespaces...${NC}"

# Create RATE_LIMIT_KV
if [ -z "$RATE_LIMIT_KV_ID" ]; then
    echo "Creating RATE_LIMIT_KV namespace..."
    RATE_LIMIT_OUTPUT=$(wrangler kv:namespace create "RATE_LIMIT_KV" 2>&1)
    RATE_LIMIT_KV_ID=$(echo "$RATE_LIMIT_OUTPUT" | grep -oP 'id = "\K[^"]+')
    echo -e "${GREEN}✓ Created RATE_LIMIT_KV: $RATE_LIMIT_KV_ID${NC}"

    # Create preview namespace
    RATE_LIMIT_PREVIEW_OUTPUT=$(wrangler kv:namespace create "RATE_LIMIT_KV" --preview 2>&1)
    RATE_LIMIT_KV_PREVIEW_ID=$(echo "$RATE_LIMIT_PREVIEW_OUTPUT" | grep -oP 'preview_id = "\K[^"]+')
    echo -e "${GREEN}✓ Created RATE_LIMIT_KV preview: $RATE_LIMIT_KV_PREVIEW_ID${NC}"
else
    echo -e "${GREEN}✓ RATE_LIMIT_KV already exists: $RATE_LIMIT_KV_ID${NC}"
fi

# Create CACHE_KV
if [ -z "$CACHE_KV_ID" ]; then
    echo "Creating CACHE_KV namespace..."
    CACHE_OUTPUT=$(wrangler kv:namespace create "CACHE_KV" 2>&1)
    CACHE_KV_ID=$(echo "$CACHE_OUTPUT" | grep -oP 'id = "\K[^"]+')
    echo -e "${GREEN}✓ Created CACHE_KV: $CACHE_KV_ID${NC}"

    # Create preview namespace
    CACHE_PREVIEW_OUTPUT=$(wrangler kv:namespace create "CACHE_KV" --preview 2>&1)
    CACHE_KV_PREVIEW_ID=$(echo "$CACHE_PREVIEW_OUTPUT" | grep -oP 'preview_id = "\K[^"]+')
    echo -e "${GREEN}✓ Created CACHE_KV preview: $CACHE_KV_PREVIEW_ID${NC}"
else
    echo -e "${GREEN}✓ CACHE_KV already exists: $CACHE_KV_ID${NC}"
fi

# Update wrangler.toml with KV namespace IDs
if [ -n "$RATE_LIMIT_KV_ID" ] && [ -n "$CACHE_KV_ID" ]; then
    echo -e "${BLUE}Updating wrangler.toml with KV namespace IDs...${NC}"
    sed -i.bak "s/id = \".*\" # RATE_LIMIT_KV/id = \"$RATE_LIMIT_KV_ID\" # RATE_LIMIT_KV/" wrangler.toml
    sed -i.bak "s/preview_id = \".*\" # RATE_LIMIT_KV/preview_id = \"$RATE_LIMIT_KV_PREVIEW_ID\" # RATE_LIMIT_KV/" wrangler.toml
    sed -i.bak "s/id = \".*\" # CACHE_KV/id = \"$CACHE_KV_ID\" # CACHE_KV/" wrangler.toml
    sed -i.bak "s/preview_id = \".*\" # CACHE_KV/preview_id = \"$CACHE_KV_PREVIEW_ID\" # CACHE_KV/" wrangler.toml
    echo -e "${GREEN}✓ Updated wrangler.toml${NC}"
fi

# Create R2 bucket
echo -e "${BLUE}Creating R2 bucket for call recordings...${NC}"
if wrangler r2 bucket list | grep -q "$R2_BUCKET_NAME"; then
    echo -e "${GREEN}✓ R2 bucket already exists: $R2_BUCKET_NAME${NC}"
else
    wrangler r2 bucket create "$R2_BUCKET_NAME"
    echo -e "${GREEN}✓ Created R2 bucket: $R2_BUCKET_NAME${NC}"
fi

# Set secrets
echo -e "${BLUE}Setting up secrets...${NC}"

if [ -n "$OPENAI_API_KEY" ]; then
    echo "$OPENAI_API_KEY" | wrangler secret put OPENAI_API_KEY
    echo -e "${GREEN}✓ Set OPENAI_API_KEY${NC}"
else
    echo -e "${YELLOW}⚠ OPENAI_API_KEY not found in .env${NC}"
fi

if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "$SUPABASE_SERVICE_ROLE_KEY" | wrangler secret put SUPABASE_SERVICE_ROLE_KEY
    echo -e "${GREEN}✓ Set SUPABASE_SERVICE_ROLE_KEY${NC}"
else
    echo -e "${YELLOW}⚠ SUPABASE_SERVICE_ROLE_KEY not found in .env${NC}"
fi

if [ -n "$SUPABASE_URL" ]; then
    echo "$SUPABASE_URL" | wrangler secret put SUPABASE_URL
    echo -e "${GREEN}✓ Set SUPABASE_URL${NC}"
else
    echo -e "${YELLOW}⚠ SUPABASE_URL not found in .env${NC}"
fi

# Deploy to development
echo ""
echo -e "${BLUE}Deploying to development environment...${NC}"
wrangler deploy

echo ""
echo -e "${GREEN}=================================================="
echo "  Setup Complete!"
echo "==================================================${NC}"
echo ""
echo -e "Your Cloudflare Worker is now deployed!"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Test the health endpoint:"
echo "   curl https://your-worker.workers.dev/health"
echo ""
echo "2. Test WebSocket connection:"
echo "   wscat -c wss://your-worker.workers.dev/ws/call-session"
echo ""
echo "3. Monitor logs:"
echo "   wrangler tail"
echo ""
echo "4. Deploy to production when ready:"
echo "   npm run deploy:production"
echo ""
echo -e "${YELLOW}Important: Update your FreeSWITCH configuration to point to:${NC}"
echo "   wss://your-worker.workers.dev/ws/call-session"
echo ""
