# ClassTrack — Academic Schedule Management System

A full-stack web application for tracking classes, tests, and assignments with real-time push notifications. Built with **vanilla JavaScript + Firebase**.

---

## 🏗️ Architecture

```
classtrack/
├── public/               ← Frontend (Firebase Hosting)
│   ├── index.html        ← Single-page app shell
│   ├── manifest.json     ← PWA manifest
│   ├── firebase-messaging-sw.js  ← Service worker for background push
│   ├── css/
│   │   └── main.css      ← Full design system
│   ├── js/
│   │   ├── firebase-config.js  ← ⚠️ YOUR CONFIG HERE
│   │   ├── auth.js       ← Google Auth + Firestore user management
│   │   ├── data.js       ← All CRUD: batches, classes, tests, assignments
│   │   ├── notifications.js  ← FCM token management + real push
│   │   └── app.js        ← Routing, pages, UI rendering
│   └── icons/            ← PWA icons
├── functions/
│   ├── index.js          ← Cloud Functions: notification scheduler
│   └── package.json
├── firestore.rules       ← Security rules
├── firestore.indexes.json
└── firebase.json         ← Hosting + Functions config
```

---

## 🚀 Setup (Step by Step)

### 1. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (e.g. `classtrack-app`)
3. Enable **Google Analytics** (optional)

### 2. Enable Firebase Services

In your Firebase console:

- **Authentication** → Sign-in method → Enable **Google**
- **Firestore Database** → Create database → Start in **production mode**
- **Cloud Messaging** (for push notifications) → automatically enabled
- **Functions** → Upgrade to **Blaze plan** (required for Cloud Functions)
- **Hosting** → Get started

### 3. Get Your Firebase Config

Firebase Console → Project Settings → Your apps → Add Web App

Copy the config object:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc123",
  measurementId: "G-XXXXXXX"
};
```

### 4. Get VAPID Key for Push Notifications

Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair

Copy the key (starts with `BN...`)

### 5. Configure the App

**Edit `public/js/firebase-config.js`:**
```javascript
const firebaseConfig = {
  // Paste your config here
};
const VAPID_KEY = "BN...your_vapid_key_here";
```

**Edit `public/firebase-messaging-sw.js`:**
- Replace the `firebaseConfig` object with the same values

### 6. Install Firebase CLI & Deploy

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Set your project
firebase use your-project-id

# Deploy Firestore rules + indexes
firebase deploy --only firestore

# Install Functions dependencies
cd functions && npm install && cd ..

# Deploy everything
firebase deploy
```

### 7. Add App Icons (Optional)

Replace the placeholder icons in `public/icons/` with:
- `icon-192.png` — 192×192 PNG
- `icon-512.png` — 512×512 PNG
- `badge-72.png` — 72×72 PNG (small notification badge)

---

## 📱 Features

### For Students
- ✅ Google Sign-In
- ✅ Browse and enroll in multiple batches/semesters
- ✅ Dashboard: today's classes, upcoming tests, pending assignments
- ✅ Weekly schedule grid view
- ✅ 6-month calendar with visual event indicators
- ✅ Tests list with countdown
- ✅ Assignments with due dates (view-only, no submission)
- ✅ Push notifications: 30 min before class/test (even when site is closed)
- ✅ In-app notification panel
- ✅ Editable personal profile

### For Class Representatives (CR)
- ✅ CR registration with Google (separate flow)
- ✅ Create and manage batches (multiple per CR)
- ✅ Add/Edit/Delete classes with day, time, room, teacher
- ✅ Add/Edit/Delete tests with date, time, venue, syllabus
- ✅ Add/Edit/Delete assignments with due date, marks, description
- ✅ Auto-notifications sent to all enrolled students on batch update
- ✅ Real-time updates — changes reflect instantly

### Push Notifications (Real, Background)
- Firebase Cloud Messaging (FCM) via Web Push API
- Service Worker receives notifications **even when browser is closed**
- Scheduled via Cloud Functions (checks every minute)
- 30-minute advance alerts for:
  - Upcoming classes (matched by day of week)
  - Upcoming tests (matched by date)
- Batch update notifications when CR edits schedule

---

## 🔐 Security Model

| Action | Student | CR (own batch) |
|--------|---------|----------------|
| Read all data | ✅ | ✅ |
| Enroll/unenroll | ✅ | ✅ |
| Update own profile | ✅ | ✅ |
| Create batch | ❌ | ✅ |
| Add/Edit classes | ❌ | ✅ |
| Add/Edit tests | ❌ | ✅ |
| Add/Edit assignments | ❌ | ✅ |
| Delete any content | ❌ | ✅ (own batch) |

Security enforced at **Firestore rules level** — no client-side bypass possible.

---

## 🔧 Local Development

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Start local emulators (Firestore + Auth + Functions)
firebase emulators:start

# The app will be at http://localhost:5000
```

---

## 📊 Firestore Data Model

```
users/{uid}
  name, email, photoURL, role: 'student'|'cr'
  enrolledBatches: [batchId...]
  managedBatches: [batchId...]  // CR only

batches/{batchId}
  name, department, semester, year, crUid

classes/{classId}
  batchId, courseName, dayOfWeek, startTime, endTime
  classroom, teacher

tests/{testId}
  batchId, title, courseName, date, time
  venue, duration, syllabus

assignments/{assignId}
  batchId, title, courseName, dueDate, marks, description

notifications/{notifId}
  userId, title, body, type, read, createdAt

fcmTokens/{uid}
  tokens: [token...]
```

---

## 🎨 Design

- Dark academic theme with deep navy palette
- Syne (headings) + IBM Plex Mono (times/codes) + Inter (body)
- Fully responsive (mobile sidebar collapses)
- PWA-ready (installable on mobile/desktop)

---

## 💡 Tips

- **Multiple semesters**: Students can enroll in multiple batches simultaneously
- **CR role**: If a user registers as CR but later signs in normally, they keep their CR role
- **Batch discovery**: All batches are visible to any logged-in user; students self-enroll
- **Notification permission**: Requested once on first login
