// One-time reset script: deletes all Firebase Auth users (except super admin)
// and clears Firestore config/owner + all users/* documents.
// Run: node scripts/reset-deployment.mjs

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load service account from .env.local
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const saMatch = envContent.match(/^FIREBASE_SERVICE_ACCOUNT=(.+)$/m);
if (!saMatch) { console.error('FIREBASE_SERVICE_ACCOUNT not found in .env.local'); process.exit(1); }

const serviceAccount = JSON.parse(Buffer.from(saMatch[1].trim(), 'base64').toString('utf8'));

const superAdminEmailMatch = envContent.match(/^VITE_SUPER_ADMIN_EMAIL=(.+)$/m);
const SUPER_ADMIN_EMAIL = superAdminEmailMatch ? superAdminEmailMatch[1].trim().toLowerCase() : '';

initializeApp({ credential: cert(serviceAccount) });
const authAdmin = getAuth();
const db = getFirestore();

async function deleteCollection(collRef) {
  const snap = await collRef.get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`  Deleted ${snap.size} docs from ${collRef.path}`);
}

async function deleteUserTree(uid) {
  const userRef = db.collection('users').doc(uid);
  const subCollections = ['clients','statuses','customFields','labels','automations',
    'leadSources','importHistory','team_members','meetings','connectedCalendars',
    'documents','documentTemplates','settings'];
  for (const col of subCollections) {
    await deleteCollection(userRef.collection(col));
  }
  await userRef.delete();
  console.log(`  Deleted Firestore user doc: users/${uid}`);
}

async function main() {
  console.log('\n🔄 Starting deployment reset...\n');

  // 1. List all Auth users
  const listResult = await authAdmin.listUsers();
  const users = listResult.users;
  console.log(`Found ${users.length} Auth user(s)`);

  for (const user of users) {
    const email = (user.email || '').toLowerCase();
    if (SUPER_ADMIN_EMAIL && email === SUPER_ADMIN_EMAIL) {
      console.log(`  Skipping super admin: ${email}`);
      continue;
    }
    // Delete from Firestore
    await deleteUserTree(user.uid);
    // Delete from Auth
    await authAdmin.deleteUser(user.uid);
    console.log(`  Deleted Auth user: ${email} (${user.uid})`);
  }

  // 2. Delete config/owner
  const ownerRef = db.collection('config').doc('owner');
  await ownerRef.delete();
  console.log('\n  Deleted config/owner');

  console.log('\n✅ Reset complete. Deployment is fresh.\n');
  process.exit(0);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
