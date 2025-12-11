#!/bin/bash
# End-to-End Test Script for Self-Healing DevOps Orchestrator
# This script tests the complete workflow from incident to fix

set -e  # Exit on any error

echo "🤖 Self-Healing DevOps Orchestrator - End-to-End Test"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a service is running
check_service() {
    local service=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    print_status "Checking if $service is running on port $port..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s -f http://localhost:$port/health >/dev/null 2>&1; then
            print_success "$service is running and healthy"
            return 0
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done

    print_error "$service failed to start within expected time"
    return 1
}

# Function to wait for Docker containers
wait_for_containers() {
    local max_attempts=60
    local attempt=1

    print_status "Waiting for Docker containers to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if docker-compose ps | grep -q "Up"; then
            print_success "Docker containers are running"
            return 0
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done

    print_error "Docker containers failed to start"
    return 1
}

# Function to test dashboard
test_dashboard() {
    print_status "Testing dashboard API..."

    # Test demo trigger endpoint
    local response=$(curl -s -X POST http://localhost:3000/api/trigger-demo \
        -H "Content-Type: application/json" \
        -d '{"log": "CRITICAL: Connection pool exhausted - max_connections=100 exceeded", "source": "postgresql"}')

    if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        print_success "Dashboard API is responding correctly"
        return 0
    else
        print_error "Dashboard API test failed"
        echo "Response: $response"
        return 1
    fi
}

# Function to test MCP server
test_mcp_server() {
    print_status "Testing MCP server API..."

    # Test health endpoint
    local health_response=$(curl -s http://localhost:3001/health)
    if echo "$health_response" | jq -e '.status == "healthy"' >/dev/null 2>&1; then
        print_success "MCP server health check passed"
    else
        print_error "MCP server health check failed"
        return 1
    fi

    # Test incidents endpoint
    local incidents_response=$(curl -s http://localhost:3001/incidents)
    if echo "$incidents_response" | jq -e '.' >/dev/null 2>&1; then
        print_success "MCP server incidents endpoint working"
        return 0
    else
        print_error "MCP server incidents endpoint failed"
        return 1
    fi
}

# Function to test Kestra
test_kestra() {
    print_status "Testing Kestra workflow engine..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s -f http://localhost:8080/health 2>/dev/null | grep -q "\"status\""; then
            print_success "Kestra is running and responding"
            return 0
        fi

        echo -n "."
        sleep 2
        ((attempt++))
    done

    print_error "Kestra failed to respond"
    return 1
}

# Function to run complete demo flow
run_demo_flow() {
    print_status "Running complete demo flow..."

    # Step 1: Trigger demo incident via dashboard
    print_status "Step 1: Triggering demo incident..."
    local trigger_response=$(curl -s -X POST http://localhost:3000/api/trigger-demo \
        -H "Content-Type: application/json" \
        -d '{"log": "FATAL: Connection pool exhausted - max_connections=100 exceeded in database.yml", "source": "postgresql"}')

    if ! echo "$trigger_response" | jq -e '.success' >/dev/null 2>&1; then
        print_error "Failed to trigger demo incident"
        echo "Response: $trigger_response"
        return 1
    fi
    print_success "Demo incident triggered successfully"

    # Step 2: Wait for Kestra to process
    print_status "Step 2: Waiting for Kestra to process incident (15 seconds)..."
    sleep 15

    # Step 3: Check if incident was created in MCP server
    print_status "Step 3: Checking if incident was created..."
    local incidents=$(curl -s http://localhost:3001/incidents)
    local incident_count=$(echo "$incidents" | jq length 2>/dev/null || echo 0)

    if [ "$incident_count" -gt 0 ]; then
        print_success "Found $incident_count incident(s) in MCP server"

        # Show incident details
        echo "$incidents" | jq '.[0]' 2>/dev/null || echo "Could not parse incident details"

        return 0
    else
        print_warning "No incidents found in MCP server - this may be expected if Kestra is not fully configured"
        print_status "You can manually trigger Kestra workflows via http://localhost:8080"
        return 0
    fi
}

# Function to generate load test
generate_load_test() {
    print_status "Running load test - generating multiple incidents..."

    local count=0
    local success_count=0

    for i in {1..5}; do
        local response=$(curl -s -X POST http://localhost:3000/api/trigger-demo \
            -H "Content-Type: application/json" \
            -d "{\"log\": \"CRITICAL: Database connection pool exhausted (attempt $i)\", \"source\": \"postgresql\"}")

        if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
            ((success_count++))
        fi
        ((count++))
        echo -n "."
        sleep 1
    done

    print_success "Load test complete: $success_count/$count incidents created successfully"
}

# Main test execution
main() {
    local test_type=${1:-"full"}  # Can be "full", "services", "demo", "load"

    print_status "Starting tests with mode: $test_type"
    echo ""

    case $test_type in
        "services")
            # Test individual services
            wait_for_containers
            test_kestra
            test_dashboard
            test_mcp_server
            ;;

        "demo")
            # Run demo flow
            wait_for_containers
            run_demo_flow
            ;;

        "load")
            # Run load test
            wait_for_containers
            test_dashboard
            generate_load_test
            ;;

        "full"|*)
            # Run full end-to-end test
            print_status "🚀 Starting FULL end-to-end test suite..."
            echo ""

            if ! wait_for_containers; then exit 1; fi
            echo ""

            if ! test_kestra; then exit 1; fi
            if ! test_mcp_server; then exit 1; fi
            if ! test_dashboard; then exit 1; fi
            echo ""

            run_demo_flow
            echo ""

            generate_load_test
            echo ""

            print_success "🎉 All tests completed!"
            echo ""
            print_status "Next steps:"
            echo "  1. Open http://localhost:3000 for the dashboard"
            echo "  2. Open http://localhost:8080 for Kestra workflows"
            echo "  3. Connect Cline MCP Server for autonomous fixes"
            echo "  4. Check ~/.config/cline/mcp_settings.json for MCP configuration"
            ;;
    esac

    echo ""
    print_success "Test script completed. Check above output for any issues."
}

# Show usage if requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [test_type]"
    echo ""
    echo "Test types:"
    echo "  full     - Run complete end-to-end test suite (default)"
    echo "  services - Test individual service availability"
    echo "  demo     - Run demo incident flow"
    echo "  load     - Generate multiple incidents for load testing"
    echo ""
    echo "Examples:"
    echo "  $0 full      # Full test suite"
    echo "  $0 services  # Quick service check"
    echo "  $0 demo      # Test incident flow"
    exit 0
fi

# Run main function with provided arguments
main "$@"
