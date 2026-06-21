// ============================================================================
// Automated per-client provisioning for a Tiklink/Simpofy CRM deployment.
//
// Turns a freshly-cloned copy of this template into a fully-working Vercel
// deployment wired to a brand-new Firebase project — in one command.
//
//   node scripts/setup-deployment.mjs
//
// What it does (each step is idempotent / safe to re-run):
//   1.  Links/creates the Vercel project
//   2.  Generates APP_ENCRYPTION_KEY + WEBHOOK_SECRET
//   3.  Sets every env var (Firebase web config, secrets, super-admin email)
//       across production / preview / development
//   4.  Ensures the Firestore (default) database exists
//   5.  Deploys firestore.rules
//   6.  Generates a Firebase service-account key and sets FIREBASE_SERVICE_ACCOUNT
//   7.  Enables the Email/Password sign-in provider (best effort)
//   8.  Creates + connects a public Vercel Blob store
//   9.  Deploys to production
//   10. Adds the production domain to Firebase's authorized domains
//   11. Connects the GitHub repo for auto-deploys
//
// PREREQUISITES (see TEMPLATE_SETUP.md for the full runbook):
//   * The Firebase PROJECT already exists and a Web App is registered (so you
//     have the web config values). Copy setup.config.example.json to
//     setup.config.json and fill it in.
//   * These CLIs are installed and authenticated FOR THIS CLIENT'S accounts:
//       - vercel   (npx vercel login)            -> the client's Vercel account
//       - gcloud   (gcloud auth login)           -> owner of the Firebase project
//       - firebase (npx firebase-tools login)    -> owner of the Firebase project
// ============================================================================

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENVIRONMENTS = ['production', 'preview', 'development'];

// ── tiny helpers ────────────────────────────────────────────────────────────
const log = (m) => console.log(m);
const step = (n, m) => console.log(`\n▶ [${n}] ${m}`);
const warn = (m) => console.warn(`  ⚠  ${m}`);
const ok = (m) => console.log(`  ✓ ${m}`);

function sh(cmd, { input, allowFail = false, capture = true, cwd = ROOT } = {}) {
  try {
    const out = execSync(cmd, {
      cwd, input,
      stdio: capture ? ['pipe', 'pipe', 'pipe'] : 'inherit',
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return (out || '').toString();
  } catch (err) {
    if (allowFail) return (err.stdout || '') + (err.stderr || '');
    console.error(`\n✗ Command failed: ${cmd}\n${err.stdout || ''}${err.stderr || ''}`);
    process.exit(1);
  }
}

function gcloudToken() {
  return sh('gcloud auth print-access-token').trim();
}

// Identity Toolkit admin API needs a quota-project header. The updateMask MUST
// match the body — fields listed in the mask but absent from the body get
// cleared — so each PATCH passes its own mask.
async function identityToolkit(projectId, method, { body, mask } = {}) {
  const url =
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config` +
    (method === 'PATCH' && mask ? `?updateMask=${encodeURIComponent(mask)}` : '');
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${gcloudToken()}`,
      'x-goog-user-project': projectId,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
  return json;
}

// ── load + validate config ──────────────────────────────────────────────────
let cfg;
try {
  cfg = JSON.parse(readFileSync(join(ROOT, 'setup.config.json'), 'utf8'));
} catch {
  console.error('Missing setup.config.json. Copy setup.config.example.json to setup.config.json and fill it in.');
  process.exit(1);
}
const fb = cfg.firebase || {};
const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
for (const k of required) {
  if (!fb[k]) { console.error(`setup.config.json: firebase.${k} is required`); process.exit(1); }
}
const PROJECT_ID = fb.projectId;
const VERCEL_PROJECT = (cfg.vercelProjectName || PROJECT_ID).toLowerCase();
const SUPER_ADMIN_EMAIL = (cfg.superAdminEmail || '').toLowerCase().trim();
const FIRESTORE_REGION = cfg.firestoreRegion || 'eur3';
const GITHUB_REPO = cfg.githubRepo || '';

if (!SUPER_ADMIN_EMAIL) { console.error('setup.config.json: superAdminEmail is required'); process.exit(1); }

log(`\n╔═ Tiklink deployment setup`);
log(`║  Firebase project : ${PROJECT_ID}`);
log(`║  Vercel project   : ${VERCEL_PROJECT}`);
log(`║  Super admin      : ${SUPER_ADMIN_EMAIL}`);
log(`╚═ (super admin must also match the email hardcoded in firestore.rules)\n`);

// ── 0. sanity-check CLI auth ────────────────────────────────────────────────
step(0, 'Checking CLI authentication');
ok(`vercel: ${sh('vercel whoami').trim()}`);
ok(`gcloud: ${sh('gcloud config get-value account 2>/dev/null', { allowFail: true }).trim()}`);

// ── 1. link/create Vercel project ───────────────────────────────────────────
step(1, `Linking Vercel project "${VERCEL_PROJECT}"`);
sh(`vercel link --yes --project ${VERCEL_PROJECT}`, { allowFail: true });
ok('linked');

// ── 2. generate secrets ─────────────────────────────────────────────────────
step(2, 'Generating secrets');
const APP_ENCRYPTION_KEY = randomBytes(32).toString('hex');
const WEBHOOK_SECRET = randomBytes(16).toString('hex');
ok('APP_ENCRYPTION_KEY + WEBHOOK_SECRET generated');

// ── 3. env vars ─────────────────────────────────────────────────────────────
step(3, 'Setting environment variables (production/preview/development)');
const vars = {
  VITE_FIREBASE_API_KEY: fb.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: fb.authDomain,
  VITE_FIREBASE_PROJECT_ID: fb.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: fb.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: fb.messagingSenderId,
  VITE_FIREBASE_APP_ID: fb.appId,
  VITE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  WEBHOOK_SECRET: WEBHOOK_SECRET,
  APP_ENCRYPTION_KEY: APP_ENCRYPTION_KEY,
  VITE_SUPER_ADMIN_EMAIL: SUPER_ADMIN_EMAIL,
};
function setEnv(name, value) {
  for (const env of ENVIRONMENTS) {
    // remove-then-add so re-runs don't choke on existing vars
    sh(`vercel env rm ${name} ${env} -y`, { allowFail: true });
    sh(`vercel env add ${name} ${env}`, { input: value, allowFail: true });
  }
  ok(name);
}
for (const [name, value] of Object.entries(vars)) setEnv(name, value);

// ── 4. ensure Firestore database ────────────────────────────────────────────
step(4, `Ensuring Firestore (default) database in ${FIRESTORE_REGION}`);
const dbOut = sh(
  `gcloud firestore databases create --location=${FIRESTORE_REGION} --project=${PROJECT_ID} --quiet`,
  { allowFail: true },
);
ok(/already exists/i.test(dbOut) ? 'already exists' : 'created');

// ── 5. deploy Firestore rules ───────────────────────────────────────────────
step(5, 'Deploying firestore.rules');
sh(`npx --no-install firebase-tools deploy --only firestore:rules --project ${PROJECT_ID}`);
ok('rules deployed');

// ── 6. service account → FIREBASE_SERVICE_ACCOUNT ───────────────────────────
step(6, 'Generating Firebase service-account key');
const saEmail = sh(
  `gcloud iam service-accounts list --project ${PROJECT_ID} --filter="displayName:firebase-adminsdk" --format="value(email)"`,
).trim().split(/\r?\n/)[0];
if (!saEmail) { console.error('No firebase-adminsdk service account found for this project.'); process.exit(1); }
const saFile = join(tmpdir(), `sa-${PROJECT_ID}-${Date.now()}.json`);
sh(`gcloud iam service-accounts keys create "${saFile}" --iam-account ${saEmail} --project ${PROJECT_ID}`);
const saB64 = Buffer.from(readFileSync(saFile)).toString('base64');
setEnv('FIREBASE_SERVICE_ACCOUNT', saB64);
try { rmSync(saFile); } catch {}
ok(`key generated from ${saEmail} and stored (base64)`);

// ── 7. enable Email/Password provider (best effort) ─────────────────────────
step(7, 'Enabling Email/Password sign-in provider');
try {
  await identityToolkit(PROJECT_ID, 'PATCH', {
    body: { signIn: { email: { enabled: true, passwordRequired: true } } },
    mask: 'signIn.email.enabled,signIn.email.passwordRequired',
  });
  ok('enabled');
} catch (e) {
  warn(`could not enable automatically (${e.message}). Enable it manually: Firebase Console -> Authentication -> Sign-in method -> Email/Password.`);
}

// ── 8. Vercel Blob store ────────────────────────────────────────────────────
step(8, 'Creating + connecting a public Vercel Blob store');
const blobOut = sh(`vercel blob create-store ${VERCEL_PROJECT}-blob --access public --yes`, { allowFail: true });
ok(/already|exists|linked|created/i.test(blobOut) ? 'store ready (BLOB_READ_WRITE_TOKEN injected)' : 'store created');

// ── 9. production deploy ────────────────────────────────────────────────────
step(9, 'Deploying to production (build runs on Vercel)');
const deployOut = sh('vercel deploy --prod --yes');
const aliasMatch = deployOut.match(/Aliased\s+(https:\/\/[^\s]+)/) || deployOut.match(/Production:\s+(https:\/\/[^\s]+)/);
let prodUrl = aliasMatch ? aliasMatch[1].trim() : '';
let prodDomain = prodUrl.replace(/^https:\/\//, '').replace(/\/$/, '');
if (prodDomain) ok(`live at ${prodUrl}`); else warn('could not parse production URL from deploy output');

// ── 10. authorized domain ───────────────────────────────────────────────────
step(10, 'Adding the production domain to Firebase authorized domains');
if (prodDomain) {
  try {
    const conf = await identityToolkit(PROJECT_ID, 'GET');
    const domains = new Set(conf.authorizedDomains || ['localhost', `${PROJECT_ID}.firebaseapp.com`, `${PROJECT_ID}.web.app`]);
    domains.add(prodDomain);
    await identityToolkit(PROJECT_ID, 'PATCH', {
      body: { authorizedDomains: [...domains] },
      mask: 'authorizedDomains',
    });
    ok(`authorized: ${prodDomain}`);
  } catch (e) {
    warn(`could not add automatically (${e.message}). Add "${prodDomain}" under Firebase Console -> Authentication -> Settings -> Authorized domains.`);
  }
} else {
  warn('skipped (no production domain).');
}

// ── 11. connect GitHub ──────────────────────────────────────────────────────
step(11, 'Connecting the GitHub repo for auto-deploys');
if (GITHUB_REPO) {
  sh(`vercel git connect ${GITHUB_REPO} --yes`, { allowFail: true });
  ok(`connected ${GITHUB_REPO}`);
} else {
  warn('githubRepo not set in config — skipped.');
}

// ── done ────────────────────────────────────────────────────────────────────
log('\n✅ Setup complete.');
if (prodUrl) log(`   ${prodUrl}`);
log('\nRemaining manual steps (optional):');
log('  - First REGULAR signup becomes the owner; further signups are blocked (single-customer).');
log(`  - Log in as ${SUPER_ADMIN_EMAIL} to reach the admin panel and impersonate the owner.`);
log('  - OWNER_UID, Google OAuth, Resend: see TEMPLATE_SETUP.md / DEPLOYMENT.md.');
