// ClassTrack Notification Scheduler
// Runs every 5 minutes via GitHub Actions
// Sends FCM push notifications 30 minutes before classes and tests

const admin = require('firebase-admin');

// ── INIT FIREBASE ADMIN ───────────────────────────────────────
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:  privateKey,
  }),
});

const db = admin.firestore();

// ── HELPERS ───────────────────────────────────────────────────
function getNowBD() {
  // Bangladesh Time = UTC+6
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 6 * 3600000);
}

function timeToMins(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function isoDate(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── GET ALL FCM TOKENS FOR A BATCH ───────────────────────────
async function getTokensForBatch(batchId) {
  const usersSnap = await db.collection('users')
    .where('enrolledBatches', 'array-contains', batchId)
    .get();

  const tokens = [];
  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    try {
      const tokenDoc = await db.collection('fcmTokens').doc(uid).get();
      if (tokenDoc.exists) {
        const data = tokenDoc.data();
        if (data.tokens && Array.isArray(data.tokens)) {
          tokens.push(...data.tokens);
        }
      }
    } catch (e) {
      console.warn(`No token for user ${uid}`);
    }
  }
  return [...new Set(tokens)]; // deduplicate
}

// ── SEND FCM NOTIFICATION ─────────────────────────────────────
async function sendNotification(tokens, title, body) {
  if (!tokens.length) {
    console.log(`No tokens for: ${title}`);
    return;
  }

  // Split into batches of 500 (FCM limit)
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        webpush: {
          notification: {
            title,
            body,
            icon: 'https://myweb-8702b.web.app/icons/icon-192.png',
            badge: 'https://myweb-8702b.web.app/icons/icon-192.png',
            requireInteraction: true,
          },
          fcmOptions: {
            link: 'https://myweb-8702b.web.app/index.html',
          },
        },
      });
      console.log(`Sent "${title}": ${response.successCount} ok, ${response.failureCount} failed`);
    } catch (e) {
      console.error(`FCM error for "${title}":`, e.message);
    }
  }
}

// ── SAVE NOTIFICATION TO FIRESTORE ────────────────────────────
async function saveNotifToFirestore(batchId, title, body) {
  try {
    const usersSnap = await db.collection('users')
      .where('enrolledBatches', 'array-contains', batchId)
      .get();

    const batch = db.batch();
    for (const userDoc of usersSnap.docs) {
      const ref = db.collection('notifications').doc();
      batch.set(ref, {
        userId: userDoc.id,
        title,
        body,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (e) {
    console.warn('Could not save notification to Firestore:', e.message);
  }
}

// ── CHECK CLASSES ─────────────────────────────────────────────
async function checkClasses() {
  const now = getNowBD();
  const todayName = DAY_NAMES[now.getDay()];
  const nowMins = timeToMins(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
  const target = nowMins + 30; // 30 minutes from now

  console.log(`Checking classes for ${todayName} at ${Math.floor(nowMins/60)}:${String(nowMins%60).padStart(2,'0')} BD time`);

  const snap = await db.collection('classes')
    .where('dayOfWeek', '==', todayName)
    .get();

  for (const doc of snap.docs) {
    const cls = doc.data();
    const startMins = timeToMins(cls.startTime);

    // Notify if class starts in 28–32 minutes (5-min window)
    if (startMins >= target - 2 && startMins <= target + 2) {
      const title = `Class in 30 minutes: ${cls.courseName}`;
      const body = `${cls.startTime} – ${cls.endTime} · Room: ${cls.classroom}${cls.teacher ? ' · ' + cls.teacher : ''}`;
      console.log(`Notifying for class: ${title}`);

      const tokens = await getTokensForBatch(cls.batchId);
      await sendNotification(tokens, title, body);
      await saveNotifToFirestore(cls.batchId, title, body);
    }
  }
}

// ── CHECK TESTS ───────────────────────────────────────────────
async function checkTests() {
  const now = getNowBD();
  const todayStr = isoDate(now);
  const nowMins = timeToMins(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
  const target = nowMins + 30;

  // Also check tomorrow for "test tomorrow" alerts
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = isoDate(tomorrow);

  const snap = await db.collection('tests').get();

  for (const doc of snap.docs) {
    const test = doc.data();

    // 30-min alert for tests today with a time set
    if (test.date === todayStr && test.time) {
      const testMins = timeToMins(test.time);
      if (testMins >= target - 2 && testMins <= target + 2) {
        const title = `Test in 30 minutes: ${test.title}`;
        const body = `${test.courseName} · ${test.time}${test.venue ? ' · ' + test.venue : ''}`;
        console.log(`Notifying for test: ${title}`);

        const tokens = await getTokensForBatch(test.batchId);
        await sendNotification(tokens, title, body);
        await saveNotifToFirestore(test.batchId, title, body);
      }
    }

    // "Test tomorrow" alert — send at 8:00 PM today
    if (test.date === tomorrowStr && now.getHours() === 20 && now.getMinutes() < 5) {
      const title = `Test tomorrow: ${test.title}`;
      const body = `${test.courseName}${test.time ? ' at ' + test.time : ''}${test.venue ? ' · ' + test.venue : ''}`;
      console.log(`Tomorrow test alert: ${title}`);

      const tokens = await getTokensForBatch(test.batchId);
      await sendNotification(tokens, title, body);
      await saveNotifToFirestore(test.batchId, title, body);
    }
  }
}

// ── CHECK ASSIGNMENTS ─────────────────────────────────────────
async function checkAssignments() {
  const now = getNowBD();
  const todayStr = isoDate(now);

  // Alert for assignments due today — send at 8:00 AM
  if (now.getHours() !== 8 || now.getMinutes() >= 5) return;

  const snap = await db.collection('assignments')
    .where('dueDate', '==', todayStr)
    .get();

  for (const doc of snap.docs) {
    const assign = doc.data();
    const title = `Assignment due today: ${assign.title}`;
    const body = `${assign.courseName}${assign.marks ? ' · ' + assign.marks + ' marks' : ''}`;
    console.log(`Assignment due alert: ${title}`);

    const tokens = await getTokensForBatch(assign.batchId);
    await sendNotification(tokens, title, body);
    await saveNotifToFirestore(assign.batchId, title, body);
  }
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  console.log('=== ClassTrack Notification Scheduler ===');
  console.log(`Running at: ${new Date().toISOString()}`);

  try {
    await Promise.all([
      checkClasses(),
      checkTests(),
      checkAssignments(),
    ]);
    console.log('=== Done ===');
  } catch (e) {
    console.error('Fatal error:', e);
    process.exit(1);
  }
}

main();
