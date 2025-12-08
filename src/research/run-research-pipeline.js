/**
 * src/research/run-research-pipeline.js
 * 
 * CLI to run the full research pipeline in one command.
 */

const { runResearchPipeline } = require('./researchPipeline');

// Args parsing
const args = process.argv.slice(2);
const kwargs = {};

args.forEach(arg => {
    if (arg.startsWith('--')) {
        const [key, val] = arg.slice(2).split('=');
        kwargs[key] = val || true;
    }
});

// Build options
const options = {};

if (kwargs.signals) options.signalsPath = kwargs.signals;
if (kwargs.execution) options.executionPath = kwargs.execution;
if (kwargs.hf) options.hfPath = kwargs.hf;
if (kwargs.results) options.resultsPath = kwargs.results;
if (kwargs.dataset) options.datasetPath = kwargs.dataset;
if (kwargs.csv) options.csvPath = kwargs.csv;
if (kwargs.limit) options.limit = parseInt(kwargs.limit);

// Build filter options
const filterOptions = {};

if (kwargs.books) {
    filterOptions.books = kwargs.books.split(',').map(b => b.trim());
}

if (kwargs.strategies) {
    filterOptions.strategies = kwargs.strategies.split(',').map(s => s.trim());
}

if (kwargs.minEdge !== undefined) {
    filterOptions.minEdge = parseFloat(kwargs.minEdge);
}

// Default: hasExecution and hasResult, unless explicitly overridden
if (Object.keys(filterOptions).length === 0) {
    filterOptions.hasExecution = true;
    filterOptions.hasResult = true;
}

options.filterOptions = filterOptions;

async function run() {
    const summary = await runResearchPipeline(options);

    console.log('=== RESEARCH PIPELINE COMPLETE ===');
    console.log(`Dataset rows: ${summary.rowCount}`);
    console.log(`Filtered for export: ${summary.filteredRowCount}`);
    console.log(`Dataset JSONL: ${summary.output.datasetPath}`);
    console.log(`Dataset CSV:   ${summary.output.csvPath}`);
    console.log('');

    // Per-book ROI (top 3)
    const bookEntries = Object.entries(summary.report.byBook)
        .sort((a, b) => (b[1].roi || 0) - (a[1].roi || 0))
        .slice(0, 3);

    if (bookEntries.length > 0) {
        console.log('Per-book ROI (top 3):');
        for (const [book, stats] of bookEntries) {
            const roi = stats.roi !== null ? `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%` : 'N/A';
            console.log(`  ${book.padEnd(12)} ${roi}`);
        }
        console.log('');
    }

    // Edge calibration (high-level)
    const nonEmptyBuckets = summary.report.edgeCalibration.filter(b => b.count > 0);
    if (nonEmptyBuckets.length > 0) {
        console.log('Edge calibration (high-level):');
        for (const bucket of nonEmptyBuckets.slice(0, 5)) {
            const edge = bucket.avgEdge !== null ? bucket.avgEdge.toFixed(1) : 'N/A';
            const realized = bucket.avgRealized !== null ? bucket.avgRealized.toFixed(1) : 'N/A';

            console.log(`  ${bucket.bucketLabel.padEnd(10)} count ${bucket.count.toString().padStart(3)}, avgEdge ${edge.padStart(4)}, avgRealized ${realized.padStart(4)}`);
        }
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
