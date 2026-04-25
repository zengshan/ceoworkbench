import { randomUUID } from 'node:crypto';
import type { ISODateTime } from './types';

export type Clock = {
  now(): ISODateTime;
};

export type IdGenerator = {
  next(prefix: string): string;
};

export class SystemClock implements Clock {
  now() {
    return new Date().toISOString();
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private nextValue = 1;

  next(prefix: string) {
    const value = String(this.nextValue).padStart(6, '0');
    this.nextValue += 1;
    return `${prefix}-${value}`;
  }
}

export class RandomIdGenerator implements IdGenerator {
  next(prefix: string) {
    return `${prefix}-${randomUUID()}`;
  }
}
