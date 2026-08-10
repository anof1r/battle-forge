import { Injectable } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  getDatabase,
  Database,
  ref,
  set,
  get,
  update,
  child,
  remove,
  onValue,
} from 'firebase/database';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private readonly app: FirebaseApp = initializeApp(environment.firebase);
  private readonly db: Database = getDatabase(this.app);

  async get<T>(path: string): Promise<T | null> {
    try {
      const snapshot = await get(child(ref(this.db), path));
      return snapshot.exists() ? (snapshot.val() as T) : null;
    } catch (error) {
      console.error('Firebase get error:', error);
      throw error;
    }
  }

  async set<T>(path: string, data: T): Promise<void> {
    try {
      await set(ref(this.db, path), data);
    } catch (error) {
      console.error('Firebase set error:', error);
      throw error;
    }
  }

  async update(path: string, data: Record<string, unknown>): Promise<void> {
    try {
      await update(ref(this.db, path), data);
    } catch (error) {
      console.error('Firebase update error:', error);
      throw error;
    }
  }

  async remove(path: string): Promise<void> {
    try {
      await remove(ref(this.db, path));
    } catch (error) {
      console.error('Firebase remove error:', error);
      throw error;
    }
  }

  subscribe<T>(path: string): Observable<T | null> {
    return new Observable((observer) => {
      const unsubscribe = onValue(
        ref(this.db, path),
        (snapshot) => {
          observer.next(snapshot.exists() ? (snapshot.val() as T) : null);
        },
        (error) => {
          observer.error(error);
        },
      );

      return () => unsubscribe();
    });
  }
}
