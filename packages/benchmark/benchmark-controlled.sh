#!/bin/bash

# Controlled Benchmark with CPU Limiting (WSL/Linux)
# This script runs benchmarks with controlled CPU usage for more consistent results

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Controlled CPU Benchmark for StaxXML Parser ===${NC}"
echo ""

# Check if cpulimit is installed
if ! command -v cpulimit &> /dev/null; then
    echo -e "${YELLOW}cpulimit not found. Installing...${NC}"
    sudo apt-get update
    sudo apt-get install -y cpulimit
fi

# Configuration
CPU_LIMIT=${CPU_LIMIT:-50}  # Limit to 50% of one core by default
RUNS=${RUNS:-10}
WARMUP=${WARMUP:-3}

echo "Configuration:"
echo "  CPU Limit: ${CPU_LIMIT}%"
echo "  Warmup runs: ${WARMUP}"
echo "  Measurement runs: ${RUNS}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"
mkdir -p "${RESULTS_DIR}"

# Result file
TIMESTAMP=$(date +%s)
RESULT_FILE="${RESULTS_DIR}/controlled-benchmark-${TIMESTAMP}.json"

echo -e "${GREEN}Starting controlled benchmark...${NC}"
echo ""

# Function to run benchmark with CPU limit
run_controlled_benchmark() {
    local variant=$1
    local test_file=$2
    local output_file=$3

    echo -e "${YELLOW}Running ${variant} with ${test_file}...${NC}"

    # Create a temporary script to run the benchmark
    cat > /tmp/bench_runner.sh <<EOF
#!/bin/bash
cd "${SCRIPT_DIR}"
export NODE_OPTIONS="--expose-gc"
node benchmark-controlled-runner.mjs "${variant}" "${test_file}" "${output_file}"
EOF

    chmod +x /tmp/bench_runner.sh

    # Run with CPU limit
    cpulimit -l ${CPU_LIMIT} -f /tmp/bench_runner.sh

    echo -e "${GREEN}Done!${NC}"
    echo ""
}

# Test files (subset for controlled testing)
TEST_FILES=(
    "small-simple.xml"
    "attribute-heavy.xml"
    "text-heavy.xml"
    "medium-nested.xml"
)

# Run benchmarks for both variants
for test_file in "${TEST_FILES[@]}"; do
    echo -e "${GREEN}Testing: ${test_file}${NC}"
    echo "========================================"

    # Baseline
    run_controlled_benchmark "baseline" "${test_file}" "${RESULT_FILE}"

    # Inlined
    run_controlled_benchmark "inlined" "${test_file}" "${RESULT_FILE}"

    echo ""
done

echo -e "${GREEN}=== Benchmark Complete ===${NC}"
echo ""
echo "Results saved to: ${RESULT_FILE}"
echo ""
echo "To analyze results, run:"
echo "  node compare-results.mjs ${RESULT_FILE}"
echo ""
echo -e "${YELLOW}Tip: For even more controlled results, consider:${NC}"
echo "  1. Disable CPU frequency scaling (sudo cpupower frequency-set -g performance)"
echo "  2. Disable turbo boost (echo 1 | sudo tee /sys/devices/system/cpu/intel_pstate/no_turbo)"
echo "  3. Pin to specific CPU core (taskset -c 0 ./benchmark-controlled.sh)"
echo "  4. Disable SMT/Hyper-Threading in BIOS"
