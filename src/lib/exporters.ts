import type { Evaluation, Session } from '@/types';
import {
  getPersona,
  getScenario,
  listEvaluations,
  listSessions,
  listTurns,
  readBackup,
  restoreBackup,
  type Backup,
} from './storage';
import { computeMetrics } from './metrics';

/** Triggers a browser download for text content. */
function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Escapes a value for CSV (quotes wrap, inner quotes doubled). */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return `"${s.replaceAll('"', '""')}"`;
}

export function toCsv(rows: (string | number | boolean | null)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

const CSV_HEADERS = [
  'date',
  'persona',
  'role',
  'call_type',
  'language',
  'difficulty',
  'mode',
  'outcome',
  'overall_score',
  'framework',
  'duration_seconds',
  'talk_ratio_rep',
  'questions',
  'open_questions',
  'longest_monologue',
  'fillers',
  'next_step_set',
];

/** One row per session — the dataset behind "my discovery score went from X to Y". */
export function buildSessionsCsv(sessions: Session[], evaluations: Evaluation[]): string {
  const evalBySession = new Map(evaluations.map((e) => [e.session_id, e]));
  const rows: (string | number | boolean | null)[][] = [CSV_HEADERS];

  for (const s of sessions) {
    const scenario = getScenario(s.scenario_id);
    const persona = scenario ? getPersona(scenario.persona_id) : undefined;
    const ev = evalBySession.get(s.id);
    const turns = listTurns(s.id);
    const m = computeMetrics(turns, s.started_at, s.ended_at ?? s.started_at, scenario?.language ?? 'pt-BR');

    rows.push([
      s.started_at,
      persona?.name ?? '',
      persona?.role ?? '',
      scenario?.call_type ?? '',
      scenario?.language ?? '',
      scenario?.difficulty ?? '',
      s.mode,
      s.outcome ?? '',
      ev?.overall_score ?? '',
      ev?.framework ?? '',
      m.durationSeconds,
      Math.round(m.talkRatioRep * 100),
      m.questionsAsked,
      m.openQuestions,
      m.longestRepMonologue,
      m.fillerCount,
      m.nextStepDetected,
    ]);
  }
  return toCsv(rows);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportSessionsCsv(): void {
  const csv = buildSessionsCsv(listSessions(), listEvaluations());
  download(`ai-call-trainer-sessions-${stamp()}.csv`, csv, 'text/csv');
}

/** Full backup — everything the app stores on this device. */
export function exportBackupJson(): void {
  download(`ai-call-trainer-backup-${stamp()}.json`, JSON.stringify(readBackup(), null, 2), 'application/json');
}

export interface ImportResult {
  ok: boolean;
  sessions: number;
  error?: string;
}

/** Restores a backup file produced by exportBackupJson(). */
export async function importBackupFile(file: File): Promise<ImportResult> {
  try {
    const parsed = JSON.parse(await file.text()) as Partial<Backup>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sessions)) {
      return { ok: false, sessions: 0, error: 'not-a-backup' };
    }
    const merged = restoreBackup(parsed);
    return { ok: true, sessions: merged };
  } catch {
    return { ok: false, sessions: 0, error: 'parse-error' };
  }
}
