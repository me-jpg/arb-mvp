/**
 * tests/architecture/dependencyRules.test.js
 * 
 * Enforce architectural boundaries between modules.
 * Prevents spaghetti dependencies and maintains clean separation.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== Architecture: Dependency Rules ===\n');

/**
 * Recursively find all .js files in a directory.
 * @param {string} dir - Directory to scan
 * @param {string[]} fileList - Accumulator for results
 * @returns {string[]} List of file paths
 */
function findJsFiles(dir, fileList = []) {
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
 * Extract require/import statements from a file.
 * @param {string} filePath - Path to file
 * @returns {Array<{line: number, module: string}>} Import statements
 */
function extractImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const imports = [];

    // Match require('...') and import ... from '...'
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;

    lines.forEach((line, index) => {
        // Check if ARCH_TEST_IGNORE is in the few lines before this one
        let hasIgnoreAnnotation = false;
        for (let lookback = Math.max(0, index - 3); lookback < index; lookback++) {
            if (lines[lookback].includes('ARCH_TEST_IGNORE')) {
                hasIgnoreAnnotation = true;
                break;
            }
        }

        if (hasIgnoreAnnotation) {
            return;
        }

        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            return;
        }

        let match;

        // Check require()
        while ((match = requireRegex.exec(line)) !== null) {
            imports.push({
                line: index + 1,
                module: match[1]
            });
        }

        requireRegex.lastIndex = 0;

        // Check import
        while ((match = importRegex.exec(line)) !== null) {
            imports.push({
                line: index + 1,
                module: match[1]
            });
        }

        importRegex.lastIndex = 0;
    });

    return imports;
}

/**
 * Check if an import violates a boundary rule.
 * @param {string} fromFile - Source file path
 * @param {string} importPath - Import module path
 * @param {string} forbiddenPattern - Forbidden pattern (e.g., '/execution/')
 * @returns {boolean} True if violation detected
 */
function checkForbiddenImport(fromFile, importPath, forbiddenPattern) {
    // Normalize paths to use forward slashes
    const normalizedImport = importPath.replace(/\\/g, '/');

    // Check if import contains forbidden pattern
    return normalizedImport.includes(forbiddenPattern);
}

/**
 * Test: /risk must NOT import from /execution
 */
{
    const violations = [];
    const riskDir = path.join(__dirname, '../../src/risk');

    if (fs.existsSync(riskDir)) {
        const riskFiles = findJsFiles(riskDir);

        riskFiles.forEach(filePath => {
            const imports = extractImports(filePath);

            imports.forEach(imp => {
                if (checkForbiddenImport(filePath, imp.module, '/execution/') ||
                    checkForbiddenImport(filePath, imp.module, '../execution/')) {
                    violations.push({
                        file: path.relative(process.cwd(), filePath),
                        line: imp.line,
                        import: imp.module
                    });
                }
            });
        });
    }

    assert.strictEqual(
        violations.length,
        0,
        `Forbidden dependency: /risk must NOT import from /execution\n` +
        violations.map(v => `  ${v.file}:${v.line} -> ${v.import}`).join('\n')
    );

    console.log('✓ Rule 1: /risk does not import from /execution');
}

/**
 * Test: /metrics must NOT import from /execution or /risk
 */
{
    const violations = [];
    const metricsDir = path.join(__dirname, '../../src/metrics');

    if (fs.existsSync(metricsDir)) {
        const metricsFiles = findJsFiles(metricsDir);

        metricsFiles.forEach(filePath => {
            const imports = extractImports(filePath);

            imports.forEach(imp => {
                const hasExecutionDep = checkForbiddenImport(filePath, imp.module, '/execution/') ||
                    checkForbiddenImport(filePath, imp.module, '../execution/');
                const hasRiskDep = checkForbiddenImport(filePath, imp.module, '/risk/') ||
                    checkForbiddenImport(filePath, imp.module, '../risk/');

                if (hasExecutionDep || hasRiskDep) {
                    violations.push({
                        file: path.relative(process.cwd(), filePath),
                        line: imp.line,
                        import: imp.module
                    });
                }
            });
        });
    }

    assert.strictEqual(
        violations.length,
        0,
        `Forbidden dependency: /metrics must NOT import from /execution or /risk\n` +
        violations.map(v => `  ${v.file}:${v.line} -> ${v.import}`).join('\n')
    );

    console.log('✓ Rule 2: /metrics does not import from /execution or /risk');
}

/**
 * Test: /execution must NOT import from /scrapers
 */
{
    const violations = [];
    const executionDir = path.join(__dirname, '../../src/execution');

    if (fs.existsSync(executionDir)) {
        const executionFiles = findJsFiles(executionDir);

        executionFiles.forEach(filePath => {
            const imports = extractImports(filePath);

            imports.forEach(imp => {
                if (checkForbiddenImport(filePath, imp.module, '/scrapers/') ||
                    checkForbiddenImport(filePath, imp.module, '../scrapers/')) {
                    violations.push({
                        file: path.relative(process.cwd(), filePath),
                        line: imp.line,
                        import: imp.module
                    });
                }
            });
        });
    }

    assert.strictEqual(
        violations.length,
        0,
        `Forbidden dependency: /execution must NOT import from /scrapers\n` +
        violations.map(v => `  ${v.file}:${v.line} -> ${v.import}`).join('\n')
    );

    console.log('✓ Rule 3: /execution does not import from /scrapers');
}

/**
 * Test: config.js must NOT import from src/* modules
 */
{
    const violations = [];
    const configFile = path.join(__dirname, '../../config.js');

    if (fs.existsSync(configFile)) {
        const imports = extractImports(configFile);

        imports.forEach(imp => {
            // Check if import starts with './src/' or '../src/'
            if (imp.module.includes('/src/') || imp.module.startsWith('./src/')) {
                violations.push({
                    file: 'config.js',
                    line: imp.line,
                    import: imp.module
                });
            }
        });
    }

    assert.strictEqual(
        violations.length,
        0,
        `Forbidden dependency: config.js must NOT import from src/* modules\n` +
        violations.map(v => `  ${v.file}:${v.line} -> ${v.import}`).join('\n')
    );

    console.log('✓ Rule 4: config.js does not import from src/* modules');
}

console.log('\n=== All dependency rules passed ===\n');
