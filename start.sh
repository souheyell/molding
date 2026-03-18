#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  🔧 Molding — One-Click Launcher
#  Checks all requirements, installs dependencies, and starts all services.
#  Usage: ./start.sh
# ═══════════════════════════════════════════════════════════════════════

set -e

# ── Colors & Formatting ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# ── Helpers ───────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}ℹ ${NC}$1"; }
success() { echo -e "${GREEN}✔ ${NC}$1"; }
warn()    { echo -e "${YELLOW}⚠ ${NC}$1"; }
fail()    { echo -e "${RED}✖ ${NC}$1"; exit 1; }
step()    { echo -e "\n${MAGENTA}${BOLD}━━━ $1 ━━━${NC}"; }
divider() { echo -e "${DIM}───────────────────────────────────────────────${NC}"; }

# ── Resolve project root (where this script lives) ───────────────────
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# ── Trap: Clean up background processes on exit ──────────────────────
PIDS=()
cleanup() {
    echo ""
    warn "Shutting down all services..."
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            wait "$pid" 2>/dev/null
        fi
    done
    success "All services stopped. Goodbye! 👋"
}
trap cleanup EXIT INT TERM

# ══════════════════════════════════════════════════════════════════════
#  BANNER
# ══════════════════════════════════════════════════════════════════════
clear
echo -e "${CYAN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║                                                  ║"
echo "  ║          🔧  M O L D I N G                       ║"
echo "  ║          Canvas → STL → G-code                   ║"
echo "  ║                                                  ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${DIM}  One-click launcher — checking requirements...${NC}"
echo ""

# ══════════════════════════════════════════════════════════════════════
#  STEP 1: CHECK SYSTEM REQUIREMENTS
# ══════════════════════════════════════════════════════════════════════
step "1/5 — Checking System Requirements"

ERRORS=0

# ── Node.js ─────────────────────────────────────────────────────
if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        success "Node.js v${NODE_VERSION} (≥18 required)"
    else
        fail "Node.js v${NODE_VERSION} found but v18+ is required. Please upgrade: https://nodejs.org"
        ERRORS=$((ERRORS + 1))
    fi
else
    fail "Node.js not found. Install it from https://nodejs.org (v18+)"
    ERRORS=$((ERRORS + 1))
fi

# ── npm ─────────────────────────────────────────────────────────
if command -v npm &>/dev/null; then
    NPM_VERSION=$(npm -v)
    success "npm v${NPM_VERSION}"
else
    fail "npm not found. It should come with Node.js."
    ERRORS=$((ERRORS + 1))
fi

# ── Python ──────────────────────────────────────────────────────
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
fi

if [ -n "$PYTHON_CMD" ]; then
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | sed 's/Python //')
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
    if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 10 ]; then
        success "Python ${PYTHON_VERSION} (≥3.10 required)"
    else
        fail "Python ${PYTHON_VERSION} found but 3.10+ is required. Please upgrade."
        ERRORS=$((ERRORS + 1))
    fi
else
    fail "Python not found. Install Python 3.10+ from https://python.org"
    ERRORS=$((ERRORS + 1))
fi

# ── pip ─────────────────────────────────────────────────────────
if [ -n "$PYTHON_CMD" ]; then
    if $PYTHON_CMD -m pip --version &>/dev/null; then
        PIP_VERSION=$($PYTHON_CMD -m pip --version | awk '{print $2}')
        success "pip v${PIP_VERSION}"
    else
        warn "pip not found. Will attempt to install Python dependencies with ensurepip..."
    fi
fi

if [ "$ERRORS" -gt 0 ]; then
    echo ""
    fail "Missing $ERRORS requirement(s). Please install them and try again."
fi

divider
success "All system requirements met!"

# ══════════════════════════════════════════════════════════════════════
#  STEP 2: CHECK PORT AVAILABILITY
# ══════════════════════════════════════════════════════════════════════
step "2/5 — Checking Port Availability"

check_port() {
    local port=$1
    local service=$2
    if lsof -i :"$port" -sTCP:LISTEN &>/dev/null; then
        warn "Port $port ($service) is already in use!"
        echo -e "  ${DIM}Run: lsof -i :$port  to see what's using it${NC}"
        echo -e "  ${DIM}Run: kill \$(lsof -t -i :$port)  to free it${NC}"
        return 1
    else
        success "Port $port ($service) — available"
        return 0
    fi
}

PORT_OK=true
check_port 3000 "Frontend"       || PORT_OK=false
check_port 3001 "Backend API"    || PORT_OK=false
check_port 5001 "Python Service" || PORT_OK=false

if [ "$PORT_OK" = false ]; then
    echo ""
    warn "Some ports are in use. Kill the processes or the app may not start correctly."
    echo -e "${DIM}  Press Enter to continue anyway, or Ctrl+C to abort...${NC}"
    read -r
fi

divider
success "Ports ready!"

# ══════════════════════════════════════════════════════════════════════
#  STEP 3: INSTALL PYTHON DEPENDENCIES
# ══════════════════════════════════════════════════════════════════════
step "3/5 — Setting Up Python Environment"

PYTHON_DIR="$PROJECT_ROOT/python-service"

# Create venv if it doesn't exist
if [ ! -d "$PYTHON_DIR/venv" ]; then
    info "Creating Python virtual environment..."
    $PYTHON_CMD -m venv "$PYTHON_DIR/venv"
    success "Virtual environment created"
else
    success "Virtual environment already exists"
fi

# Activate venv
source "$PYTHON_DIR/venv/bin/activate"
success "Virtual environment activated"

# Install/update dependencies
info "Installing Python dependencies..."
pip install -q -r "$PYTHON_DIR/requirements.txt" 2>&1 | tail -1
success "Python dependencies installed"

divider

# ══════════════════════════════════════════════════════════════════════
#  STEP 4: INSTALL NODE DEPENDENCIES
# ══════════════════════════════════════════════════════════════════════
step "4/5 — Installing Node.js Dependencies"

# Backend
if [ ! -d "$PROJECT_ROOT/backend/node_modules" ]; then
    info "Installing backend dependencies..."
    (cd "$PROJECT_ROOT/backend" && npm install --silent 2>&1 | tail -1)
    success "Backend dependencies installed"
else
    success "Backend dependencies already installed"
fi

# Frontend
if [ ! -d "$PROJECT_ROOT/frontend/node_modules" ]; then
    info "Installing frontend dependencies (this may take a minute)..."
    (cd "$PROJECT_ROOT/frontend" && npm install --silent 2>&1 | tail -1)
    success "Frontend dependencies installed"
else
    success "Frontend dependencies already installed"
fi

divider
success "All dependencies ready!"

# ══════════════════════════════════════════════════════════════════════
#  STEP 5: LAUNCH ALL SERVICES
# ══════════════════════════════════════════════════════════════════════
step "5/5 — Launching Services"

# Create logs directory
LOGS_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOGS_DIR"

# ── Start Python Microservice ───────────────────────────────────
info "Starting Python geometry service on port 5001..."
(cd "$PYTHON_DIR" && source venv/bin/activate && python app.py) \
    > "$LOGS_DIR/python.log" 2>&1 &
PIDS+=($!)

# Wait for Python service to be ready
PYTHON_READY=false
for i in {1..20}; do
    if curl -s http://localhost:5001/health &>/dev/null; then
        PYTHON_READY=true
        break
    fi
    sleep 0.5
done

if [ "$PYTHON_READY" = true ]; then
    success "Python service running → http://localhost:5001"
else
    warn "Python service may still be starting (check $LOGS_DIR/python.log)"
fi

# ── Start Node.js Backend ───────────────────────────────────────
info "Starting Node.js backend on port 3001..."
(cd "$PROJECT_ROOT/backend" && node server.js) \
    > "$LOGS_DIR/backend.log" 2>&1 &
PIDS+=($!)

# Wait for backend
BACKEND_READY=false
for i in {1..15}; do
    if curl -s http://localhost:3001/api/health &>/dev/null; then
        BACKEND_READY=true
        break
    fi
    sleep 0.5
done

if [ "$BACKEND_READY" = true ]; then
    success "Backend API running → http://localhost:3001"
else
    warn "Backend may still be starting (check $LOGS_DIR/backend.log)"
fi

# ── Start Next.js Frontend ──────────────────────────────────────
info "Starting Next.js frontend on port 3000..."
(cd "$PROJECT_ROOT/frontend" && npm run dev) \
    > "$LOGS_DIR/frontend.log" 2>&1 &
PIDS+=($!)

# Wait for frontend
FRONTEND_READY=false
for i in {1..30}; do
    if curl -s http://localhost:3000 &>/dev/null; then
        FRONTEND_READY=true
        break
    fi
    sleep 1
done

if [ "$FRONTEND_READY" = true ]; then
    success "Frontend running → http://localhost:3000"
else
    warn "Frontend may still be compiling (check $LOGS_DIR/frontend.log)"
fi

# ══════════════════════════════════════════════════════════════════════
#  READY!
# ══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  🎉  Molding is running!${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}🌐 App:${NC}       ${BOLD}http://localhost:3000${NC}"
echo -e "  ${CYAN}🔌 API:${NC}       http://localhost:3001"
echo -e "  ${CYAN}⚙️  Geometry:${NC}  http://localhost:5001"
echo ""
echo -e "  ${DIM}Logs:  $LOGS_DIR/${NC}"
echo -e "  ${DIM}Press Ctrl+C to stop all services${NC}"
echo ""

# ── Open browser ────────────────────────────────────────────────
if [ "$FRONTEND_READY" = true ]; then
    if command -v open &>/dev/null; then
        open "http://localhost:3000"
    elif command -v xdg-open &>/dev/null; then
        xdg-open "http://localhost:3000"
    fi
fi

# ── Keep script alive until Ctrl+C ─────────────────────────────
wait
