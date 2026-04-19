/**
 * Statistical analysis utilities for benchmark comparisons
 */
/**
 * Calculate descriptive statistics for a sample
 */
export function calculateDescriptiveStats(sample) {
    if (sample.length === 0) {
        throw new Error('Cannot calculate statistics for empty sample');
    }
    const sorted = [...sample].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = sorted.reduce((sum, x) => sum + x, 0) / n;
    const median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];
    const variance = sorted.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    const coefficientOfVariation = mean !== 0 ? stdDev / mean : 0;
    return {
        mean,
        median,
        stdDev,
        variance,
        min: sorted[0],
        max: sorted[n - 1],
        q1,
        q3,
        iqr,
        coefficientOfVariation
    };
}
/**
 * Normal cumulative distribution function (CDF)
 * Using approximation for standard normal distribution
 */
function normalCDF(x) {
    // Abramowitz and Stegun approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - probability : probability;
}
/**
 * Student's t-distribution CDF approximation
 * For degrees of freedom > 30, use normal approximation
 */
function tDistributionCDF(t, df) {
    if (df > 30) {
        // Use normal approximation for large df
        return normalCDF(t);
    }
    // For smaller df, use a more accurate approximation
    // This is a simplified version - for production use, consider a proper implementation
    const x = df / (df + t * t);
    return 1 - 0.5 * Math.pow(x, df / 2);
}
/**
 * Perform Welch's t-test (doesn't assume equal variances)
 * More robust than Student's t-test for real-world data
 */
export function welchTTest(sample1, sample2, confidenceLevel = 0.95) {
    if (sample1.length < 2 || sample2.length < 2) {
        throw new Error('Need at least 2 samples in each group');
    }
    const stats1 = calculateDescriptiveStats(sample1);
    const stats2 = calculateDescriptiveStats(sample2);
    const n1 = sample1.length;
    const n2 = sample2.length;
    // Welch's t-statistic
    const standardError = Math.sqrt((stats1.variance / n1) + (stats2.variance / n2));
    const tStatistic = (stats1.mean - stats2.mean) / standardError;
    // Welch-Satterthwaite degrees of freedom
    const numerator = Math.pow((stats1.variance / n1) + (stats2.variance / n2), 2);
    const denominator = Math.pow(stats1.variance / n1, 2) / (n1 - 1) +
        Math.pow(stats2.variance / n2, 2) / (n2 - 1);
    const df = numerator / denominator;
    // Two-tailed p-value
    const pValue = 2 * (1 - tDistributionCDF(Math.abs(tStatistic), df));
    const significant = pValue < (1 - confidenceLevel);
    // Calculate improvement percentage (negative means regression)
    const improvement = ((stats2.mean - stats1.mean) / stats1.mean) * 100;
    return {
        tStatistic,
        pValue,
        significant,
        confidenceLevel,
        mean1: stats1.mean,
        mean2: stats2.mean,
        improvement: -improvement // negative because lower is better for timing
    };
}
/**
 * Perform Student's t-test (assumes equal variances)
 */
export function studentTTest(sample1, sample2, confidenceLevel = 0.95) {
    if (sample1.length < 2 || sample2.length < 2) {
        throw new Error('Need at least 2 samples in each group');
    }
    const stats1 = calculateDescriptiveStats(sample1);
    const stats2 = calculateDescriptiveStats(sample2);
    const n1 = sample1.length;
    const n2 = sample2.length;
    // Pooled standard deviation
    const pooledVariance = ((n1 - 1) * stats1.variance + (n2 - 1) * stats2.variance) / (n1 + n2 - 2);
    const pooledStdDev = Math.sqrt(pooledVariance);
    // t-statistic
    const standardError = pooledStdDev * Math.sqrt(1 / n1 + 1 / n2);
    const tStatistic = (stats1.mean - stats2.mean) / standardError;
    // Degrees of freedom
    const df = n1 + n2 - 2;
    // Two-tailed p-value
    const pValue = 2 * (1 - tDistributionCDF(Math.abs(tStatistic), df));
    const significant = pValue < (1 - confidenceLevel);
    const improvement = ((stats2.mean - stats1.mean) / stats1.mean) * 100;
    return {
        tStatistic,
        pValue,
        significant,
        confidenceLevel,
        mean1: stats1.mean,
        mean2: stats2.mean,
        improvement: -improvement
    };
}
/**
 * Detect outliers using the IQR method
 */
export function detectOutliers(sample) {
    const stats = calculateDescriptiveStats(sample);
    const lowerBound = stats.q1 - 1.5 * stats.iqr;
    const upperBound = stats.q3 + 1.5 * stats.iqr;
    const outliers = [];
    const cleaned = [];
    sample.forEach(value => {
        if (value < lowerBound || value > upperBound) {
            outliers.push(value);
        }
        else {
            cleaned.push(value);
        }
    });
    return { outliers, cleaned, lowerBound, upperBound };
}
/**
 * Calculate confidence interval for the mean
 */
export function confidenceInterval(sample, confidenceLevel = 0.95) {
    const stats = calculateDescriptiveStats(sample);
    const n = sample.length;
    // For large samples (n > 30), use z-score; otherwise use t-distribution
    const criticalValue = n > 30
        ? 1.96 // z-score for 95% confidence
        : 2.0; // conservative t-value approximation
    const standardError = stats.stdDev / Math.sqrt(n);
    const margin = criticalValue * standardError;
    return {
        lower: stats.mean - margin,
        upper: stats.mean + margin,
        margin
    };
}
/**
 * Calculate effect size (Cohen's d)
 * Measures the magnitude of difference between two groups
 */
export function cohensD(sample1, sample2) {
    const stats1 = calculateDescriptiveStats(sample1);
    const stats2 = calculateDescriptiveStats(sample2);
    const n1 = sample1.length;
    const n2 = sample2.length;
    // Pooled standard deviation
    const pooledVariance = ((n1 - 1) * stats1.variance + (n2 - 1) * stats2.variance) / (n1 + n2 - 2);
    const pooledStdDev = Math.sqrt(pooledVariance);
    const d = (stats1.mean - stats2.mean) / pooledStdDev;
    // Interpretation based on Cohen's conventions
    let interpretation;
    const absD = Math.abs(d);
    if (absD < 0.2) {
        interpretation = 'negligible';
    }
    else if (absD < 0.5) {
        interpretation = 'small';
    }
    else if (absD < 0.8) {
        interpretation = 'medium';
    }
    else {
        interpretation = 'large';
    }
    return { d, interpretation };
}
/**
 * Format statistical results for display
 */
export function formatStatisticalReport(baseline, optimized, baselineName = 'Baseline', optimizedName = 'Optimized') {
    const tTest = welchTTest(baseline, optimized);
    const effect = cohensD(baseline, optimized);
    const baselineStats = calculateDescriptiveStats(baseline);
    const optimizedStats = calculateDescriptiveStats(optimized);
    const lines = [];
    lines.push('');
    lines.push('=== Statistical Analysis ===');
    lines.push('');
    lines.push(`${baselineName}:`);
    lines.push(`  Mean: ${baselineStats.mean.toFixed(3)} ms`);
    lines.push(`  Median: ${baselineStats.median.toFixed(3)} ms`);
    lines.push(`  Std Dev: ${baselineStats.stdDev.toFixed(3)} ms`);
    lines.push(`  Range: [${baselineStats.min.toFixed(3)}, ${baselineStats.max.toFixed(3)}] ms`);
    lines.push(`  CV: ${(baselineStats.coefficientOfVariation * 100).toFixed(1)}%`);
    lines.push('');
    lines.push(`${optimizedName}:`);
    lines.push(`  Mean: ${optimizedStats.mean.toFixed(3)} ms`);
    lines.push(`  Median: ${optimizedStats.median.toFixed(3)} ms`);
    lines.push(`  Std Dev: ${optimizedStats.stdDev.toFixed(3)} ms`);
    lines.push(`  Range: [${optimizedStats.min.toFixed(3)}, ${optimizedStats.max.toFixed(3)}] ms`);
    lines.push(`  CV: ${(optimizedStats.coefficientOfVariation * 100).toFixed(1)}%`);
    lines.push('');
    lines.push('Comparison:');
    lines.push(`  Improvement: ${tTest.improvement.toFixed(2)}%`);
    lines.push(`  Speedup: ${(baselineStats.mean / optimizedStats.mean).toFixed(2)}x`);
    lines.push('');
    lines.push('Statistical Significance:');
    lines.push(`  t-statistic: ${tTest.tStatistic.toFixed(3)}`);
    lines.push(`  p-value: ${tTest.pValue.toFixed(6)}`);
    lines.push(`  Significant: ${tTest.significant ? 'YES' : 'NO'} (95% confidence)`);
    lines.push(`  Effect size (Cohen's d): ${effect.d.toFixed(3)} (${effect.interpretation})`);
    lines.push('');
    if (tTest.significant) {
        if (tTest.improvement > 0) {
            lines.push(`✓ Performance improvement is statistically significant`);
        }
        else {
            lines.push(`✗ Performance regression is statistically significant`);
        }
    }
    else {
        lines.push(`~ No statistically significant difference detected`);
    }
    return lines.join('\n');
}
