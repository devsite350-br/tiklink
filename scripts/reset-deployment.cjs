// One-time reset script — run from project root: node scripts/reset-deployment.cjs
const admin = require('../node_modules/firebase-admin/lib/index.js');
const { readFileSync } = require('fs');
const { join } = require('path');

const envContent = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');

const saMatch = envContent.match(/^FIREBASE_SERVICE_ACCOUNT=(.+)$/m);
if (!saMatch) { console.error('FIREBASE_SERVICE_ACCOUNT not found in .env.local'); process.exit(1); }
const serviceAccount = JSON.parse(Buffer.from(saMatch[1].trim(), 'base64').toString('utf8'));

const superAdminMatch = envContent.match(/^VITE_SUPER_ADMIN_EMAIL=(.+)$/m);
const SUPER_ADMIN_EMAIL = superAdminMatch ? superAdminMatch[1].trim().toLowerCase() : '';

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const authAdmin = admin.auth();
const db = admin.firestore();

async function deleteCollection(colRef) {
  const snap = await colRef.get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`  Deleted ${snap.size} doc(s) from ${colRef.path}`);
}

async function deleteUserTree(uid) {
  const userRef = db.collection('users').doc(uid);
  for (const col of ['clients','statuses','customFields','labels','automations',
    'leadSources','importHistory','team_members','meetings','connectedCalendars',
    'documents','documentTemplates','settings']) {
    await deleteCollection(userRef.collection(col));
  }
  await userRef.delete();
  console.log(`  Deleted Firestore users/${uid}`);
}

async function main() {
  console.log('\n🔄 Starting deployment reset...\n');

  const { users } = await authAdmin.listUsers();
  console.log(`Found ${users.length} Auth user(s)`);

  for (const user of users) {
    const email = (user.email || '').toLowerCase();
    if (SUPER_ADMIN_EMAIL && email === SUPER_ADMIN_EMAIL) {
      console.log(`  Skipping super admin: ${email}`);
      continue;
    }
    await deleteUserTree(user.uid);
    await authAdmin.deleteUser(user.uid);
    console.log(`  Deleted Auth user: ${email}`);
  }

  await db.collection('config').doc('owner').delete();
  console.log('\n  Cleared config/owner');

  console.log('\n✅ Reset complete. Deployment is fresh.\n');
  process.exit(0);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
