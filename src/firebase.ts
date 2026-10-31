import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
  type Auth,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  type Firestore,
} from 'firebase/firestore'

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
}

const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: 'AIzaSyDemA8TdY52zJJ-O2NfojIMOFnZAM_7Z5U',
  authDomain: 'slips-361df.firebaseapp.com',
  projectId: 'slips-361df',
  storageBucket: 'slips-361df.firebasestorage.app',
  messagingSenderId: '197699485716',
  appId: '1:197699485716:web:85ae4b9442140f5f6ea701',
}

export function getStoredFirebaseConfig(): FirebaseConfig {
  // 1. Check environment variables (from .env.local or production hosting env)
  const envConfig: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  }

  if (envConfig.apiKey && envConfig.projectId && envConfig.appId) {
    return envConfig
  }

  // 2. Fallback to built-in project credentials
  return DEFAULT_FIREBASE_CONFIG
}

let appInstance: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

export function initFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  const config = getStoredFirebaseConfig()
  if (!config) return null

  try {
    if (getApps().length === 0) {
      appInstance = initializeApp(config)
    } else {
      appInstance = getApp()
    }
    authInstance = getAuth(appInstance)
    dbInstance = getFirestore(appInstance)
    return { app: appInstance, auth: authInstance, db: dbInstance }
  } catch (err) {
    console.error('Failed to initialize Firebase:', err)
    return null
  }
}

// Initial attempt to bind instances
const initialized = initFirebase()
export const auth: Auth | null = initialized?.auth ?? null
export const db: Firestore | null = initialized?.db ?? null

export function isFirebaseConfigured(): boolean {
  return getStoredFirebaseConfig() !== null
}

// Authentication Helpers
export async function signUpUser(email: string, pass: string): Promise<User> {
  const currentAuth = authInstance ?? initFirebase()?.auth
  if (!currentAuth) throw new Error('Firebase is not configured. Please add your Firebase credentials.')
  const credential = await createUserWithEmailAndPassword(currentAuth, email, pass)
  return credential.user
}

export async function signInUser(email: string, pass: string): Promise<User> {
  const currentAuth = authInstance ?? initFirebase()?.auth
  if (!currentAuth) throw new Error('Firebase is not configured. Please add your Firebase credentials.')
  const credential = await signInWithEmailAndPassword(currentAuth, email, pass)
  return credential.user
}

export async function signInWithGoogle(): Promise<User> {
  const currentAuth = authInstance ?? initFirebase()?.auth
  if (!currentAuth) throw new Error('Firebase is not configured. Please add your Firebase credentials.')
  const provider = new GoogleAuthProvider()
  const credential = await signInWithPopup(currentAuth, provider)
  return credential.user
}

export async function resetUserPassword(email: string): Promise<void> {
  const currentAuth = authInstance ?? initFirebase()?.auth
  if (!currentAuth) throw new Error('Firebase is not configured. Please add your Firebase credentials.')
  await sendPasswordResetEmail(currentAuth, email)
}

export async function signOutUser(): Promise<void> {
  const currentAuth = authInstance ?? initFirebase()?.auth
  if (!currentAuth) return
  await signOut(currentAuth)
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  const currentAuth = authInstance ?? initFirebase()?.auth
  if (!currentAuth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(currentAuth, callback)
}

// Firestore Cloud Storage Helpers
export interface CloudDataPayload {
  habits: unknown[]
  habitStates: Record<string, unknown>
  firstUsedDate?: string
  activeHabitId?: string
  backups?: unknown[]
  updatedAt?: string
}

export async function saveUserDataToCloud(userId: string, data: CloudDataPayload): Promise<void> {
  const currentDb = dbInstance ?? initFirebase()?.db
  if (!currentDb) throw new Error('Firebase Firestore is not initialized.')

  const userDocRef = doc(currentDb, 'users', userId)
  await setDoc(userDocRef, {
    ...data,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
}

export async function getUserDataFromCloud(userId: string): Promise<CloudDataPayload | null> {
  const currentDb = dbInstance ?? initFirebase()?.db
  if (!currentDb) throw new Error('Firebase Firestore is not initialized.')

  const userDocRef = doc(currentDb, 'users', userId)
  const snap = await getDoc(userDocRef)
  if (!snap.exists()) return null
  return snap.data() as CloudDataPayload
}

export function subscribeToCloudUserData(userId: string, callback: (data: CloudDataPayload | null) => void): () => void {
  const currentDb = dbInstance ?? initFirebase()?.db
  if (!currentDb) return () => {}

  const userDocRef = doc(currentDb, 'users', userId)
  return onSnapshot(userDocRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as CloudDataPayload)
    } else {
      callback(null)
    }
  }, (err) => {
    console.error('Error subscribing to cloud user data:', err)
  })
}
