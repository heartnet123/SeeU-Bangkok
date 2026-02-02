#!/bin/bash
# Multi-Agent System Manual Test Script
# Run: bash apps/server/src/agent/__tests__/test-agent-v2.sh

set -e

BASE_URL="${API_URL:-http://localhost:3000}"
AGENT_V2_URL="$BASE_URL/api/agent/v2"

echo "🧪 Multi-Agent System Test Suite"
echo "=================================="
echo "Base URL: $BASE_URL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }
info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

# Test 1: Health Check
echo "Test 1: Health Check"
echo "--------------------"
HEALTH=$(curl -s "$AGENT_V2_URL/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
    success "Health check passed"
    echo "$HEALTH" | jq .
else
    fail "Health check failed"
    echo "$HEALTH"
fi
echo ""

# Test 2: List Agents
echo "Test 2: List Agents"
echo "--------------------"
AGENTS=$(curl -s "$AGENT_V2_URL/agents")
if echo "$AGENTS" | grep -q 'researcher_agent'; then
    success "Agents endpoint works"
    echo "$AGENTS" | jq '.agents[].name'
else
    fail "Agents endpoint failed"
fi
echo ""

# Test 3: Simple Research Query (non-streaming)
echo "Test 3: Research Query (non-streaming)"
echo "---------------------------------------"
RESEARCH=$(curl -s -X POST "$AGENT_V2_URL" \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"What temples are famous in Bangkok?"}],"stream":false}')

if echo "$RESEARCH" | grep -q '"success":true'; then
    success "Research query succeeded"
    echo "Response preview:"
    echo "$RESEARCH" | jq -r '.response' | head -c 300
    echo "..."
else
    fail "Research query failed"
    echo "$RESEARCH" | jq .
fi
echo ""
echo ""

# Test 4: Nearby Places Query
echo "Test 4: Nearby Places Query"
echo "----------------------------"
NEARBY=$(curl -s -X POST "$AGENT_V2_URL" \
    -H "Content-Type: application/json" \
    -d '{
        "messages":[{"role":"user","content":"Find cafes near me"}],
        "userLocation":{"lat":13.7563,"lng":100.5018},
        "stream":false
    }')

if echo "$NEARBY" | grep -q '"success":true'; then
    success "Nearby query succeeded"
    PLACES_COUNT=$(echo "$NEARBY" | jq '.places | length // 0')
    echo "Found $PLACES_COUNT places"
else
    fail "Nearby query failed"
    echo "$NEARBY" | jq .
fi
echo ""

# Test 5: Planning Query (triggers all 3 agents)
echo "Test 5: Planning Query (Full Agent Flow)"
echo "-----------------------------------------"
info "This should trigger: Researcher → Planner → Critic"
PLAN=$(curl -s -X POST "$AGENT_V2_URL" \
    -H "Content-Type: application/json" \
    -d '{
        "messages":[{"role":"user","content":"Plan a half-day trip to 3 temples near Khao San Road"}],
        "userLocation":{"lat":13.7588,"lng":100.4974},
        "stream":false
    }')

if echo "$PLAN" | grep -q '"success":true'; then
    success "Planning query succeeded"
    
    TOOLS_USED=$(echo "$PLAN" | jq -r '.tools_used[]?' 2>/dev/null | tr '\n' ', ')
    echo "Tools used: $TOOLS_USED"
    
    if echo "$PLAN" | grep -q '"itinerary"'; then
        success "Itinerary was generated"
        echo "$PLAN" | jq '.itinerary.title, .itinerary.stops | length'
    else
        info "No itinerary in response (may need more context)"
    fi
else
    fail "Planning query failed"
    echo "$PLAN" | jq .
fi
echo ""

# Test 6: SSE Streaming
echo "Test 6: SSE Streaming"
echo "----------------------"
info "Testing SSE stream (first 20 lines)..."
STREAM_OUTPUT=$(timeout 15 curl -s -N -X POST "$AGENT_V2_URL" \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"Hello, what can you help me with?"}],"stream":true}' \
    2>&1 | head -20)

if echo "$STREAM_OUTPUT" | grep -q 'event:'; then
    success "SSE streaming works"
    echo "Events received:"
    echo "$STREAM_OUTPUT" | grep 'event:' | head -5
else
    fail "SSE streaming failed or no events"
    echo "$STREAM_OUTPUT"
fi
echo ""

# Summary
echo "=================================="
echo "Test Summary"
echo "=================================="
echo "1. Health Check: Run"
echo "2. List Agents: Run"
echo "3. Research Query: Run"
echo "4. Nearby Query: Run"
echo "5. Planning Query: Run"
echo "6. SSE Streaming: Run"
echo ""
echo "🎉 All tests executed!"
echo ""
echo "Note: For full verification, check:"
echo "  - LangSmith traces at https://smith.langchain.com"
echo "  - Supabase tables for memory persistence"
