import type { EngineInput } from '@mediafox/naming-engine';
import type { WebNamingResult } from '@mediafox/naming-engine';

export type FounderReviewData = {
  wouldInvest: number;    // 1–5
  wouldRemember: number;  // 1–5
  imagineNasdaq: number;  // 1–5
  wouldAnnounce: number;  // 1–5
  billionDollar: number;  // 1–5
  notes: string;
  founderScore: number;   // computed average × 20
};

export type LabSession = {
  id: string;
  input: EngineInput | null;
  results: WebNamingResult | null;
  founderReviews: Record<string, FounderReviewData>;
  compareSelection: string[];
  createdAt: string;
  updatedAt: string;
};

const SESSION_KEY = 'forge-labs:session';

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function now(): string {
  return new Date().toISOString();
}

export function loadSession(): LabSession {
  if (typeof window === 'undefined') return emptySession();
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as LabSession;
  } catch {
    // ignore corrupt session
  }
  return emptySession();
}

export function saveSession(session: LabSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, updatedAt: now() }));
  } catch {
    // ignore storage errors
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

function emptySession(): LabSession {
  return {
    id: generateId(),
    input: null,
    results: null,
    founderReviews: {},
    compareSelection: [],
    createdAt: now(),
    updatedAt: now(),
  };
}

export function computeFounderScore(r: FounderReviewData): number {
  const avg = (r.wouldInvest + r.wouldRemember + r.imagineNasdaq + r.wouldAnnounce + r.billionDollar) / 5;
  return Math.round(avg * 20);
}
