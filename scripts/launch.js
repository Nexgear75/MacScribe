#!/usr/bin/env node
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import http from 'http';
import fs from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const BACKEND_PORT = process.env.PORT || 8000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const MAX_RETRIES = 30;
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version;

let backendProc = null;
let cliProc = null;

const isWin = process.platform === 'win32';

// ─── Styling ─────────────────────────────────────────────────────────────────

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const LABEL_W = 14;
const PAD = '   ';

const c = {
  bold:   s => `\x1b[1m${s}\x1b[22m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
};

class Spinner {
  constructor() {
    this._frame = 0;
    this._timer = null;
    this._label = '';
    this._msg = '';
  }

  start(label, msg = '') {
    this._label = label;
    this._msg = msg;
    this._frame = 0;
    process.stdout.write('\x1b[?25l');
    this._render();
    this._timer = setInterval(() => this._render(), 80);
    return this;
  }

  update(msg) {
    this._msg = msg;
    return this;
  }

  stop(msg = '') {
    this._clear();
    clearInterval(this._timer);
    process.stdout.write('\x1b[?25h');
    console.log(`${PAD}${c.green('✓')}  ${c.bold(this._label.padEnd(LABEL_W))}${c.dim(msg)}`);
    return this;
  }

  fail(msg = '') {
    this._clear();
    clearInterval(this._timer);
    process.stdout.write('\x1b[?25h');
    console.log(`${PAD}${c.red('✗')}  ${c.bold(this._label.padEnd(LABEL_W))}${c.dim(msg)}`);
    return this;
  }

  _render() {
    const f = c.dim(FRAMES[this._frame % FRAMES.length]);
    this._frame++;
    process.stdout.write(`\r${PAD}${f}  ${c.bold(this._label.padEnd(LABEL_W))}${c.dim(this._msg)}`);
  }

  _clear() {
    process.stdout.write('\r\x1b[2K');
  }
}

function warn(label, msg) {
  console.log(`${PAD}${c.yellow('!')}  ${c.bold(label.padEnd(LABEL_W))}${msg}`);
}

function fatal(msg) {
  console.log(`\n${PAD}${c.red('✗')}  ${msg}\n`);
}

// ─── Health check ────────────────────────────────────────────────────────────

async function checkBackend() {
  return new Promise(resolve => {
    const req = http.get(`${BACKEND_URL}/health`, res => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function waitForBackend(spinner, retries = 0) {
  if (await checkBackend()) return true;
  if (retries >= MAX_RETRIES) {
    throw new Error(`backend did not respond after ${MAX_RETRIES}s`);
  }
  spinner.update(`waiting... ${retries + 1}/${MAX_RETRIES}`);
  await new Promise(r => setTimeout(r, 1000));
  return waitForBackend(spinner, retries + 1);
}

// ─── Python ──────────────────────────────────────────────────────────────────

async function checkPython() {
  try {
    const cmd = isWin ? 'python' : 'python3';
    const { stdout } = await execAsync(`${cmd} --version`);
    return { cmd, version: stdout.trim().replace('Python ', '') };
  } catch {
    return null;
  }
}

// ─── Environment ─────────────────────────────────────────────────────────────

async function setupPythonEnv(pythonCmd, spinner) {
  const backendPath = join(ROOT, 'backend');
  const venvPath    = join(backendPath, '.venv');
  const reqFile     = join(backendPath, 'requirements.txt');
  const reqFlag     = join(backendPath, '.requirements_installed');
  const pipCmd      = isWin
    ? join(venvPath, 'Scripts', 'pip.exe')
    : join(venvPath, 'bin', 'pip');

  if (!existsSync(venvPath)) {
    spinner.update('creating virtual environment...');
    await execAsync(`${pythonCmd} -m venv .venv`, { cwd: backendPath });
  }

  let shouldInstall = !existsSync(reqFlag);
  if (!shouldInstall) {
    try {
      shouldInstall = statSync(reqFile).mtime > statSync(reqFlag).mtime;
    } catch {
      shouldInstall = true;
    }
  }

  if (shouldInstall) {
    spinner.update('installing dependencies...');
    const { stderr } = await execAsync(`"${pipCmd}" install -q -r requirements.txt`, { cwd: backendPath });
    if (stderr && stderr.toLowerCase().includes('error')) {
      throw new Error(`pip install failed:\n${stderr}`);
    }
    await fs.writeFile(reqFlag, new Date().toISOString());
  }

  const envPath = join(backendPath, '.env');
  if (!existsSync(envPath)) {
    spinner.stop('ready');
    warn('env', 'backend/.env not found  —  add DEEPSEEK_API_KEY=...');
    const answer = await askQuestion(`${PAD}   continue anyway? [y/N]  `);
    if (!['y', 'yes', 'o', 'oui'].includes(answer.toLowerCase())) process.exit(1);
    console.log('');
    return { venvPath, envMissing: true };
  }

  return { venvPath };
}

function askQuestion(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt);
    process.stdin.once('data', data => resolve(data.toString().trim()));
  });
}

// ─── Backend ─────────────────────────────────────────────────────────────────

async function startBackend(venvPath) {
  const backendPath = join(ROOT, 'backend');
  const pythonPath  = isWin
    ? join(venvPath, 'Scripts', 'python.exe')
    : join(venvPath, 'bin', 'python');

  return new Promise((resolve, reject) => {
    backendProc = spawn(pythonPath, ['app.py'], {
      cwd: backendPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: !isWin,
    });

    let resolved = false;
    let errorOutput = '';

    backendProc.stderr?.on('data', data => {
      const str = data.toString();
      errorOutput += str;
      if (!resolved && (str.includes('Application startup complete') || str.includes('Uvicorn running'))) {
        resolved = true;
        resolve();
      }
    });

    backendProc.stdout?.on('data', () => {});

    backendProc.on('error', err => reject(new Error(`backend spawn failed: ${err.message}`)));

    backendProc.on('exit', code => {
      if (!resolved && code !== 0 && code !== null) {
        reject(new Error(`backend exited (code ${code}):\n${errorOutput}`));
      }
    });

    setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 10000);
  });
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function buildCLI(spinner) {
  const cliPath  = join(ROOT, 'cli');
  const distPath = join(cliPath, 'dist', 'source', 'cli.js');

  if (!existsSync(distPath)) {
    spinner.update('compiling...');
    await execAsync('npm run build', { cwd: cliPath });
  }

  return distPath;
}

async function startCLI(distPath) {
  return new Promise((resolve, reject) => {
    cliProc = spawn('node', [distPath], {
      stdio: 'inherit',
      shell: isWin,
    });
    cliProc.on('error', err => reject(new Error(`cli error: ${err.message}`)));
    cliProc.on('exit', code => resolve(code));
  });
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup() {
  process.stdout.write('\x1b[?25h');
  if (cliProc && !cliProc.killed) cliProc.kill();
  if (backendProc && !backendProc.killed) {
    try { process.kill(-backendProc.pid, 'SIGTERM'); } catch { backendProc.kill('SIGTERM'); }
  }
  await new Promise(r => setTimeout(r, 500));
  process.exit(0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const spinner = new Spinner();

  try {
    console.clear();
    console.log('');
    console.log(`   ${c.bold('MacScribe')}  ${c.dim(`v${VERSION}`)}`);
    console.log(`   ${c.dim('─'.repeat(28))}`);
    console.log('');

    spinner.start('python', 'checking...');
    const py = await checkPython();
    if (!py) {
      spinner.fail('not found');
      fatal('Python 3 is required  —  https://python.org');
      process.exit(1);
    }
    spinner.stop(py.version);

    spinner.start('environment', 'checking...');
    const { venvPath, envMissing } = await setupPythonEnv(py.cmd, spinner);
    if (!envMissing) spinner.stop('ready');

    spinner.start('backend', 'starting...');
    await startBackend(venvPath);
    await waitForBackend(spinner);
    spinner.stop(`:${BACKEND_PORT}`);

    spinner.start('cli', 'loading...');
    const distPath = await buildCLI(spinner);
    spinner.stop('ready');

    console.log('');
    console.log(`   ${c.dim('─'.repeat(28))}`);
    console.log('');

    await startCLI(distPath);

  } catch (err) {
    spinner.fail(err.message.split('\n')[0]);
    const detail = err.message.split('\n').slice(1).filter(l => l.trim());
    if (detail.length) {
      console.log('');
      detail.forEach(l => console.log(`      ${c.dim(l)}`));
    }
    console.log('');
    if (backendProc) backendProc.kill();
    process.exit(1);
  }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  if (backendProc && !backendProc.killed) backendProc.kill();
});

main();
