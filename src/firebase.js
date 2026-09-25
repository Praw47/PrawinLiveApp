
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'

const requiredConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const missingConfig = Object.entries(requiredConfig).filter(([, value]) => !value).map(([key]) => key)
const firebaseConfigured = missingConfig.length === 0
if (missingConfig.length) {
  console.warn(`Firebase is not configured. Missing: ${missingConfig.join(', ')}`)
}

export const firebaseApp = firebaseConfigured ? initializeApp(requiredConfig) : null
export const auth = firebaseApp ? getAuth(firebaseApp) : null
export const db = firebaseApp ? getFirestore(firebaseApp) : null
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export const authReady = auth ? setPersistence(auth, browserLocalPersistence) : Promise.resolve()
export const ADMIN_EMAIL = 'kprawin@gmail.com'
export const isAdminUser = (user) => user?.email?.toLowerCase() === ADMIN_EMAIL
const unavailable = () => Promise.reject(new Error('Firebase authentication is not configured.'))
export const firebaseAuth = {
  signInWithEmail: (email, password) => auth ? authReady.then(() => signInWithEmailAndPassword(auth, email, password)) : unavailable(),
  signUpWithEmail: (email, password) => auth ? authReady.then(() => createUserWithEmailAndPassword(auth, email, password)) : unavailable(),
  signInWithGoogle: () => auth ? authReady.then(() => signInWithPopup(auth, googleProvider)) : unavailable(),
  resetPassword: (email) => auth ? sendPasswordResetEmail(auth, email) : unavailable(),
  signOut: () => auth ? signOut(auth) : Promise.resolve(),
}