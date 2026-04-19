/**
 * Comprehensive benchmark configuration
 */
// Default configuration
export const defaultConfig = {
    warmupRuns: 3,
    measurementRuns: 10,
    gcBetweenRuns: true,
    timeout: 300,
    testPatterns: [
        {
            name: 'small-simple',
            enabled: true,
            description: 'Small XML with simple structure (< 1KB)',
            expectedSize: 500
        },
        {
            name: 'medium-nested',
            enabled: true,
            description: 'Medium XML with nested structure (10-100KB)',
            expectedSize: 50_000
        },
        {
            name: 'large-complex',
            enabled: true,
            description: 'Large XML with complex structure (1-10MB)',
            expectedSize: 5_000_000
        },
        {
            name: 'huge-document',
            enabled: false, // Disabled by default due to long execution time
            description: 'Huge XML document (10-100MB)',
            expectedSize: 50_000_000
        },
        {
            name: 'attribute-heavy',
            enabled: true,
            description: 'XML with many attributes per element',
            expectedSize: 1_000_000
        },
        {
            name: 'text-heavy',
            enabled: true,
            description: 'XML with large text content',
            expectedSize: 2_000_000
        },
        {
            name: 'cdata-heavy',
            enabled: true,
            description: 'XML with many CDATA sections',
            expectedSize: 500_000
        },
        {
            name: 'namespace-heavy',
            enabled: true,
            description: 'XML with multiple namespaces',
            expectedSize: 100_000
        },
        {
            name: 'mixed-content',
            enabled: true,
            description: 'XML with mixed content types',
            expectedSize: 1_000_000
        }
    ],
    profiling: {
        enabled: true,
        methods: ['inspector'],
        iterations: 100,
        generateFlameGraphs: true
    },
    output: {
        resultsDir: 'results',
        formats: ['json', 'console', 'html'],
        saveRawSamples: true
    },
    thresholds: {
        minThroughputMBps: 10,
        maxP95LatencyMs: 1000,
        maxMemoryUsageMB: 500
    }
};
// Quick benchmark configuration (fewer runs, smaller files)
export const quickConfig = {
    ...defaultConfig,
    warmupRuns: 1,
    measurementRuns: 5,
    testPatterns: defaultConfig.testPatterns.map(p => ({
        ...p,
        enabled: p.expectedSize < 1_000_000 // Only small/medium files
    }))
};
// Comprehensive benchmark configuration (more runs, all files)
export const comprehensiveConfig = {
    ...defaultConfig,
    warmupRuns: 5,
    measurementRuns: 20,
    testPatterns: defaultConfig.testPatterns.map(p => ({
        ...p,
        enabled: true // Enable all test patterns
    }))
};
// CI/CD benchmark configuration (optimized for automated testing)
export const ciConfig = {
    ...defaultConfig,
    warmupRuns: 2,
    measurementRuns: 5,
    timeout: 180,
    testPatterns: defaultConfig.testPatterns.map(p => ({
        ...p,
        enabled: p.expectedSize < 5_000_000 // Skip huge files in CI
    })),
    profiling: {
        enabled: false, // Disable profiling in CI
        methods: [],
        iterations: 0,
        generateFlameGraphs: false
    },
    output: {
        resultsDir: 'results',
        formats: ['json', 'markdown'], // Only structured formats for CI
        saveRawSamples: false
    }
};
// Load configuration based on environment
export function loadConfig() {
    const configType = process.env.BENCHMARK_CONFIG || 'default';
    switch (configType) {
        case 'quick':
            return quickConfig;
        case 'comprehensive':
            return comprehensiveConfig;
        case 'ci':
            return ciConfig;
        default:
            return defaultConfig;
    }
}
// Merge custom configuration with defaults
export function mergeConfig(custom, base = defaultConfig) {
    return {
        ...base,
        ...custom,
        testPatterns: custom.testPatterns || base.testPatterns,
        profiling: {
            ...base.profiling,
            ...(custom.profiling || {})
        },
        output: {
            ...base.output,
            ...(custom.output || {})
        },
        thresholds: {
            ...base.thresholds,
            ...(custom.thresholds || {})
        }
    };
}
export default defaultConfig;
