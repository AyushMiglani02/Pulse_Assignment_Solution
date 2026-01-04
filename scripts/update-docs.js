const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Script to update PROJECT_DOCUMENTATION.md with latest test results
 * Runs backend and frontend tests and updates test counts automatically
 */

const ROOT_DIR = path.join(__dirname, '..');
const DOCS_PATH = path.join(ROOT_DIR, 'PROJECT_DOCUMENTATION.md');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runCommand(command, cwd) {
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, output: error.stdout || error.message };
  }
}

function parseTestResults(output) {
  const testMatch = output.match(/Tests:\s+(\d+)\s+passed/i);
  const suiteMatch = output.match(/Test Suites:\s+(\d+)\s+passed/i);

  return {
    passed: testMatch ? parseInt(testMatch[1]) : 0,
    suites: suiteMatch ? parseInt(suiteMatch[1]) : 0,
  };
}

function updateDocumentation(backendResults, frontendResults) {
  if (!fs.existsSync(DOCS_PATH)) {
    log('PROJECT_DOCUMENTATION.md not found. Skipping update.', colors.yellow);
    return;
  }

  let content = fs.readFileSync(DOCS_PATH, 'utf8');

  // Update timestamp
  const timestamp = new Date().toISOString();
  content = content.replace(
    /Last Updated: .*/,
    `Last Updated: ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`
  );

  // Update backend test count
  content = content.replace(
    /Backend: \d+ tests passing/,
    `Backend: ${backendResults.passed} tests passing`
  );

  // Update frontend test count
  content = content.replace(
    /Frontend: \d+ tests passing/,
    `Frontend: ${frontendResults.passed} tests passing`
  );

  fs.writeFileSync(DOCS_PATH, content, 'utf8');
  log('✓ Documentation updated successfully', colors.green);
}

async function main() {
  log('\n📊 Running tests and updating documentation...\n', colors.blue);

  // Run backend tests
  log('Running backend tests...', colors.yellow);
  const backendPath = path.join(ROOT_DIR, 'backend');
  const backendResult = runCommand('npm test -- --passWithNoTests', backendPath);
  const backendTests = parseTestResults(backendResult.output);
  log(
    `Backend: ${backendTests.passed} tests passed, ${backendTests.suites} suites`,
    backendResult.success ? colors.green : colors.red
  );

  // Run frontend tests
  log('\nRunning frontend tests...', colors.yellow);
  const frontendPath = path.join(ROOT_DIR, 'frontend');
  const frontendResult = runCommand('npm test', frontendPath);
  const frontendTests = parseTestResults(frontendResult.output);
  log(
    `Frontend: ${frontendTests.passed} tests passed, ${frontendTests.suites} suites`,
    frontendResult.success ? colors.green : colors.red
  );

  // Update documentation
  log('\nUpdating documentation...', colors.yellow);
  updateDocumentation(backendTests, frontendTests);

  log('\n✓ Done!\n', colors.green);
}

main().catch(error => {
  log(`\n❌ Error: ${error.message}\n`, colors.red);
  process.exit(1);
});
