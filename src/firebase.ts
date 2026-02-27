import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyA8xoktIzGgpPEklg_e_vWgkMU6E3Bjlkw",
  authDomain: "color-73b3e.firebaseapp.com",
  projectId: "color-73b3e",
  storageBucket: "color-73b3e.firebasestorage.app",
  messagingSenderId: "450293394727",
  appId: "1:450293394727:web:8486e1ff4d1c083275cd02",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
