import { Injectable } from '@angular/core';

/**
 * Centralized logging so components/services never call `console.*` directly.
 * Swap the implementation here (e.g. to a remote logging backend) in one place.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  error(context: string, error: unknown): void {
    console.error(`[${context}]`, error);
  }

  warn(context: string, message: string): void {
    console.warn(`[${context}]`, message);
  }

  info(context: string, message: string): void {
    console.info(`[${context}]`, message);
  }
}
