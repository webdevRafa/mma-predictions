import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { firebaseConfig, isFirebaseConfigComplete } from './firebaseConfig'

export const firebaseApp: FirebaseApp | null = isFirebaseConfigComplete
  ? getApps()[0] ?? initializeApp(firebaseConfig)
  : null

export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null
