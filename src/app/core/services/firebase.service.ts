import { Injectable, InjectionToken, inject } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
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
import { LoggerService } from './logger.service';

export const FIREBASE_DATABASE = new InjectionToken<Database>('Firebase Realtime Database', {
  providedIn: 'root',
  factory: () => {
    const app = getApps().length > 0 ? getApp() : initializeApp(environment.firebase);
    return getDatabase(app);
  },
});

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private readonly logger = inject(LoggerService);
  private readonly db = inject(FIREBASE_DATABASE);

  async get<T>(path: string): Promise<T | null> {
    try {
      const snapshot = await get(child(ref(this.db), path));
      return snapshot.exists() ? (snapshot.val() as T) : null;
    } catch (error) {
      this.logger.error('FirebaseService.get', error);
      throw error;
    }
  }

  async set<T>(path: string, data: T): Promise<void> {
    try {
      await set(ref(this.db, path), data);
    } catch (error) {
      this.logger.error('FirebaseService.set', error);
      throw error;
    }
  }

  async update(path: string, data: Record<string, unknown>): Promise<void> {
    try {
      await update(ref(this.db, path), data);
    } catch (error) {
      this.logger.error('FirebaseService.update', error);
      throw error;
    }
  }

  async remove(path: string): Promise<void> {
    try {
      await remove(ref(this.db, path));
    } catch (error) {
      this.logger.error('FirebaseService.remove', error);
      throw error;
    }
  }

  subscribe<T>(path: string): Observable<T | null> {
    return new Observable<T | null>((observer) => {
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
