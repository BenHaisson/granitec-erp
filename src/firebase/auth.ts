import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from './config';

export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signOut = () => firebaseSignOut(auth);
