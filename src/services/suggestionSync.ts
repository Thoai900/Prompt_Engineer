import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, handleFirestoreError } from '../firebase';
import {
  exportUserModel, loadUserModelFromData, isDirty, clearDirty,
  loadAnonFromLocalStorage, saveAnonToLocalStorage, clearAnonLocalStorage,
} from './suggestionStore';

const FLUSH_MS = 10000;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let currentUid: string | null = null;

async function flush() {
  if (!isDirty()) return;
  if (currentUid) {
    try {
      const ref = doc(db, 'suggestionModels', currentUid);
      const data = exportUserModel();
      const snap = await getDoc(ref);
      await setDoc(ref, {
        ...data,
        userId: currentUid,
        updatedAt: serverTimestamp(),
        ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
      }, { merge: true });
      clearDirty();
    } catch (e) {
      try { handleFirestoreError(e, 'write', `suggestionModels/${currentUid}`); } catch { /* swallow */ }
    }
  } else {
    saveAnonToLocalStorage();
    clearDirty();
  }
}

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, FLUSH_MS);
}

export function initSuggestionSync(): () => void {
  loadAnonFromLocalStorage();

  const interval = setInterval(() => { if (isDirty()) scheduleFlush(); }, 3000);
  const onUnload = () => { flush(); };
  window.addEventListener('beforeunload', onUnload);

  const unsubAuth = onAuthStateChanged(auth, async (user) => {
    currentUid = user?.uid || null;
    if (currentUid) {
      try {
        const ref = doc(db, 'suggestionModels', currentUid);
        const snap = await getDoc(ref);
        if (snap.exists()) loadUserModelFromData(snap.data() as any);
        // Any anonymous data is already merged into the runtime model; push it up.
        if (isDirty()) await flush();
        clearAnonLocalStorage();
      } catch (e) {
        try { handleFirestoreError(e, 'get', `suggestionModels/${currentUid}`); } catch { /* swallow */ }
      }
    }
  });

  return () => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', onUnload);
    unsubAuth();
    if (flushTimer) clearTimeout(flushTimer);
  };
}
