const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// Run every minute to check for upcoming classes/tests
exports.scheduleNotifications = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async (context) => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000);
    const in31 = new Date(now.getTime() + 31 * 60 * 1000);

    const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const todayName = dayNames[now.getDay()];

    // Check classes scheduled today within 30 min window
    const classesSnap = await db.collection("classes")
      .where("dayOfWeek", "==", todayName)
      .get();

    for (const doc of classesSnap.docs) {
      const cls = doc.data();
      const [h, m] = cls.startTime.split(":").map(Number);
      const classTime = new Date(now);
      classTime.setHours(h, m, 0, 0);

      if (classTime >= in30 && classTime < in31) {
        await notifyBatch(cls.batchId, {
          title: `📚 Class in 30 minutes!`,
          body: `${cls.courseName} — Room ${cls.classroom} at ${cls.startTime}`,
          type: "class",
          data: { classId: doc.id, batchId: cls.batchId }
        });
      }
    }

    // Check tests within 30 min window
    const todayStr = now.toISOString().split("T")[0];
    const testsSnap = await db.collection("tests")
      .where("date", "==", todayStr)
      .get();

    for (const doc of testsSnap.docs) {
      const test = doc.data();
      if (!test.time) continue;
      const [h, m] = test.time.split(":").map(Number);
      const testTime = new Date(now);
      testTime.setHours(h, m, 0, 0);

      if (testTime >= in30 && testTime < in31) {
        await notifyBatch(test.batchId, {
          title: `⚠️ Test in 30 minutes!`,
          body: `${test.courseName} — ${test.title} at ${test.time} in ${test.venue || "TBA"}`,
          type: "test",
          data: { testId: doc.id, batchId: test.batchId }
        });
      }
    }

    return null;
  });

async function notifyBatch(batchId, notification) {
  // Get all users enrolled in this batch
  const usersSnap = await db.collection("users")
    .where("enrolledBatches", "array-contains", batchId)
    .get();

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;

    // Store in-app notification
    await db.collection("notifications").add({
      userId: uid,
      batchId,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      data: notification.data,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send FCM push notification
    const tokenDoc = await db.collection("fcmTokens").doc(uid).get();
    if (tokenDoc.exists) {
      const tokens = tokenDoc.data().tokens || [];
      if (tokens.length > 0) {
        try {
          await messaging.sendEachForMulticast({
            tokens,
            notification: {
              title: notification.title,
              body: notification.body,
            },
            data: notification.data || {},
            webpush: {
              notification: {
                title: notification.title,
                body: notification.body,
                icon: "/icons/icon-192.png",
                badge: "/icons/badge-72.png",
                vibrate: [200, 100, 200],
                requireInteraction: true,
              },
              fcmOptions: { link: "/" }
            }
          });
        } catch (err) {
          console.error("FCM send error:", err);
        }
      }
    }
  }
}

// When CR publishes an update, notify all batch students
exports.onBatchUpdate = functions.firestore
  .document("batches/{batchId}")
  .onUpdate(async (change, context) => {
    const batchId = context.params.batchId;
    const before = change.before.data();
    const after = change.after.data();

    if (JSON.stringify(before) === JSON.stringify(after)) return null;

    const usersSnap = await db.collection("users")
      .where("enrolledBatches", "array-contains", batchId)
      .get();

    for (const userDoc of usersSnap.docs) {
      await db.collection("notifications").add({
        userId: userDoc.id,
        batchId,
        title: "📋 Batch schedule updated",
        body: `${after.name} routine has been updated by CR`,
        type: "update",
        data: { batchId },
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const tokenDoc = await db.collection("fcmTokens").doc(userDoc.id).get();
      if (tokenDoc.exists) {
        const tokens = tokenDoc.data().tokens || [];
        if (tokens.length > 0) {
          await messaging.sendEachForMulticast({
            tokens,
            notification: {
              title: "📋 Schedule Updated",
              body: `${after.name} routine has been updated by your CR`,
            },
            webpush: {
              notification: { icon: "/icons/icon-192.png", requireInteraction: false },
              fcmOptions: { link: "/" }
            }
          });
        }
      }
    }
    return null;
  });
