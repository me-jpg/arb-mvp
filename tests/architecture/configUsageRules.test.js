/**
 * tests/architecture/configUsageRules.test.js
 * 
 * Enforce config.js as single source of truth for tunables.
 * Prevents magic numbers from creeping into core logic.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== Architecture: Config Usage Rules ===\n');

/**
 * Recursively find all .js files in a directory.
 * @param {string} dir - Directory to scan
 * @param {string[]} fileList - Accumulator for results
 * @returns {string[]} List of file paths
 */
function findJsFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) {
        return fileList;
    }

    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            findJsFiles(filePath, fileList);
        } else if (file.endsWith('.js')) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

/**
 * Keywords that suggest a line contains tunable configuration.
 */
const CONFIG_KEYWORDS = [
    'limit',
    'threshold',
    'cap',
    'retry',
    'delay',
    'exposure',
    'risk',
    'max',
    'min',
    'timeout',
    'backoff',
    'window'
];

/**
 * Scan file for hardcoded configuration values.
 * @param {string} filePath - Path to file
 * @returns {Array<{line: number, content: string, value: number}>} Violations
 */
function scanForHardcodedConfig(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const violations = [];

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            return;
        }

        // Skip lines with ARCH_TEST_IGNORE on same line
        if (line.includes('// ARCH_TEST_IGNORE') || line.includes('/* ARCH_TEST_IGNORE')) {
            return;
        }

        // Check if previous line has ARCH_TEST_IGNORE (for annotations above code)
        if (index > 0 && lines[index - 1].includes('ARCH_TEST_IGNORE')) {
            return;
        }

        // Check if line contains any config keywords (case-insensitive)
        const lowerLine = line.toLowerCase();
        const hasKeyword = CONFIG_KEYWORDS.some(keyword => lowerLine.includes(keyword));

        if (!hasKeyword) {
            return;
        }

        // Look for numeric literals (excluding 0, 1, which are often boolean-like or indices)
        // Match patterns like: = 100, > 0.5, : 2000, etc.
        const numericPatterns = [
            /[=:><!]\s*(\d+\.\d+)/g,  // Decimals like 0.5, 100.0
            /[=:><!]\s*([2-9]\d+)/g,  // Integers >= 20 (to avoid false positives on 0, 1, 2, etc.)
        ];

        let foundNumber = false;
        numericPatterns.forEach(pattern => {
            if (pattern.test(line)) {
                foundNumber = true;
            }
        });

        if (foundNumber) {
            violations.push({
                line: index + 1,
                content: trimmed,
                file: path.relative(process.cwd(), filePath)
            });
        }
    });

    return violations;
}

/**
 * Test: src/execution should not have hardcoded config values
 */
{
    const violations = [];
    const executionDir = path.join(__dirname, '../../src/execution');
    const executionFiles = findJsFiles(executionDir);

    executionFiles.forEach(filePath => {
        const fileViolations = scanForHardcodedConfig(filePath);
        violations.push(...fileViolations);
    });

    assert.strictEqual(
        violations.length,
        0,
        `Hardcoded config values detected in src/execution:\n` +
        violations.slice(0, 10).map(v =>
            `  ${v.file}:${v.line}\n    ${v.content}\n    → Move to config.js or annotate with // ARCH_TEST_IGNORE`
        ).join('\n') +
        (violations.length > 10 ? `\n  ... and ${violations.length - 10} more violations` : '')
    );

    console.log('✓ Rule 1: src/execution has no hardcoded config values');
}

/**
 * Test: src/risk should not have hardcoded config values
 */
{
    const violations = [];
    const riskDir = path.join(__dirname, '../../src/risk');
    const riskFiles = findJsFiles(riskDir);

    riskFiles.forEach(filePath => {
        const fileViolations = scanForHardcodedConfig(filePath);
        violations.push(...fileViolations);
    });

    assert.strictEqual(
        violations.length,
        0,
        `Hardcoded config values detected in src/risk:\n` +
        violations.slice(0, 10).map(v =>
            `  ${v.file}:${v.line}\n    ${v.content}\n    → Move to config.js or annotate with // ARCH_TEST_IGNORE`
        ).join('\n') +
        (violations.length > 10 ? `\n  ... and ${violations.length - 10} more violations` : '')
    );

    console.log('✓ Rule 2: src/risk has no hardcoded config values');
}

console.log('\n=== All config usage rules passed ===\n');
