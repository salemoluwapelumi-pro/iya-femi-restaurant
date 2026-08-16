// Syntax-checks every JS file in the project (backend, frontend, database).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const roots = ['backend', 'frontend/js', 'database', 'scripts'];
let failed = false;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) {
      try {
        execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
      } catch (err) {
        failed = true;
        console.error(`Syntax error in ${full}:\n${err.stderr}`);
      }
    }
  }
}

for (const root of roots) {
  const dir = path.join(__dirname, '..', root);
  if (fs.existsSync(dir)) walk(dir);
}
if (failed) process.exit(1);
console.log('All JS files pass syntax check.');
