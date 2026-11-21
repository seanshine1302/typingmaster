import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDa3Gfb7gLAEdORyIekvIJGKKwTcwKfWw4",
  authDomain: "typingmaster-a8efe.firebaseapp.com",
  projectId: "typingmaster-a8efe",
  storageBucket: "typingmaster-a8efe.firebasestorage.app",
  messagingSenderId: "515936667727",
  appId: "1:515936667727:web:4898e54c6cbadcecb0023a",
};

const COLLECTION_NAME = 'typing_users';

function cleanForFirestore(userObj) {
  return JSON.parse(JSON.stringify(userObj));
}

function initFirebaseBridge() {
  const TypingApp = (window.TypingApp = window.TypingApp || {});

  try {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const usersCol = collection(db, COLLECTION_NAME);

    const bridge = {
      ready: true,

      async fetchAllUsers() {
        const snapshot = await getDocs(usersCol);
        const list = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          list.push({ ...data, id: data.id || docSnap.id });
        });
        return list;
      },

      async upsertUser(userObj) {
        if (!userObj || !userObj.id) return;
        const ref = doc(db, COLLECTION_NAME, String(userObj.id));
        await setDoc(ref, cleanForFirestore(userObj));
      },

      async deleteUser(userId) {
        if (!userId) return;
        const ref = doc(db, COLLECTION_NAME, String(userId));
        await deleteDoc(ref);
      },

      async replaceAllUsers(users, previousIds) {
        const batch = writeBatch(db);
        const nextIds = new Set();

        (users || []).forEach((userObj) => {
          if (!userObj || !userObj.id) return;
          const id = String(userObj.id);
          nextIds.add(id);
          batch.set(doc(db, COLLECTION_NAME, id), cleanForFirestore(userObj));
        });

        (previousIds || []).forEach((oldId) => {
          const id = String(oldId);
          if (!nextIds.has(id)) {
            batch.delete(doc(db, COLLECTION_NAME, id));
          }
        });

        await batch.commit();
      },

      subscribeUsers(onUpdate, onError) {
        return onSnapshot(
          usersCol,
          (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() || {};
              list.push({ ...data, id: data.id || docSnap.id });
            });
            if (typeof onUpdate === 'function') {
              onUpdate(list, snapshot.metadata);
            }
          },
          (err) => {
            if (typeof onError === 'function') {
              onError(err);
            }
          }
        );
      },
    };

    TypingApp.FirebaseBridge = bridge;

    if (TypingApp.ProfileStore && typeof TypingApp.ProfileStore.attachRemoteBridge === 'function') {
      TypingApp.ProfileStore.attachRemoteBridge(bridge);
    }
  } catch (err) {
    console.warn('[FirebaseSync] Firestore 초기화에 실패하여 로컬 캐시 모드로 동작합니다.', err);
  }
}

initFirebaseBridge();
