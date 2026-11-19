import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Evaluation, Session, Turn } from '@/types';
import { MAX_SESSIONS, listSessions, listTurns, pruneHistory, saveTurn } from './storage';

/**
 * localStorage em memória com orçamento de bytes opcional — reproduz o
 * QuotaExceededError real, que é o que dispara o caminho de poda e retry.
 * `seed` escreve direto no mapa, ignorando o orçamento, para montar um estado
 * já estourado.
 */
function budgetStorage(limitBytes = Infinity) {
  const map = new Map<string, string>();
  const total = (exceptKey: string) =>
    [...map.entries()].reduce((n, [k, v]) => (k === exceptKey ? n : n + v.length), 0);
  const api = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => {
      if (total(k) + v.length > limitBytes) {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }
      map.set(k, v);
    },
  };
  return { storage: api as unknown as Storage, seed: (k: string, v: string) => map.set(k, v) };
}

function session(i: number): Session {
  return {
    id: `s${i}`,
    scenario_id: 'sc1',
    // Datas crescentes: s0 é a mais antiga, então é a primeira a sair.
    started_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    ended_at: null,
    outcome: null,
    mode: 'text',
  } as Session;
}

function turn(sessionId: string, i: number): Turn {
  return {
    id: `${sessionId}-t${i}`,
    session_id: sessionId,
    speaker: i % 2 === 0 ? 'rep' : 'prospect',
    content: `linha ${i}`,
    ts: new Date(Date.UTC(2026, 0, 1, 1, i)).toISOString(),
  } as Turn;
}

function evaluation(sessionId: string): Evaluation {
  return {
    id: `${sessionId}-e`,
    session_id: sessionId,
    created_at: new Date(Date.UTC(2026, 0, 2)).toISOString(),
    overall_score: 70,
    framework: 'basic',
    scores: { abertura: { score: 7, comment: 'ok' } },
    strengths: [{ point: 'a', quote: 'b' }],
    improvements: [{ point: 'a', instead_try: 'b' }],
  } as Evaluation;
}

let store: ReturnType<typeof budgetStorage>;

beforeEach(() => {
  store = budgetStorage();
  vi.stubGlobal('localStorage', store.storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pruneHistory', () => {
  it('não faz nada abaixo do cap', () => {
    store.seed('act.sessions', JSON.stringify([session(1), session(2)]));
    expect(pruneHistory()).toEqual({ sessions: 0, turns: 0, evaluations: 0 });
    expect(listSessions()).toHaveLength(2);
  });

  it('mantém as N mais recentes e descarta as mais antigas', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => session(i));
    store.seed('act.sessions', JSON.stringify(sessions));

    const dropped = pruneHistory(4);

    expect(dropped.sessions).toBe(6);
    const kept = listSessions().map((s) => s.id);
    // listSessions ordena por started_at desc: as 4 mais novas são s9..s6.
    expect(kept).toEqual(['s9', 's8', 's7', 's6']);
  });

  it('recolhe turnos e avaliações órfãos junto com a sessão', () => {
    store.seed('act.sessions', JSON.stringify([session(1), session(2)]));
    store.seed('act.turns', JSON.stringify([turn('s1', 0), turn('s1', 1), turn('s2', 0)]));
    store.seed('act.evaluations', JSON.stringify([evaluation('s1'), evaluation('s2')]));

    const dropped = pruneHistory(1);

    expect(dropped).toEqual({ sessions: 1, turns: 2, evaluations: 1 });
    expect(listTurns('s1')).toHaveLength(0);
    expect(listTurns('s2')).toHaveLength(1);
  });

  it('sessão sem data válida é ignorada na leitura (nunca chega a ser podada)', () => {
    const undated = { ...session(5), started_at: '' } as Session;
    store.seed('act.sessions', JSON.stringify([undated, session(1), session(2)]));

    pruneHistory(2);

    expect(listSessions().map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('expõe um cap padrão sensato', () => {
    expect(MAX_SESSIONS).toBeGreaterThanOrEqual(50);
  });
});

describe('gravação com cota estourada', () => {
  it('poda e tenta de novo, para a call nova nunca ser perdida', async () => {
    // Orçamento exatamente do tamanho das 60 sessões já gravadas: sem folga,
    // qualquer gravação nova estoura até que a poda libere espaço.
    const sessions = Array.from({ length: 60 }, (_, i) => session(i));
    const sessionsJson = JSON.stringify(sessions);
    const tight = budgetStorage(sessionsJson.length);
    tight.seed('act.sessions', sessionsJson);
    vi.stubGlobal('localStorage', tight.storage);

    // Sem o retry isto lançaria QuotaExceededError e derrubaria o fim da call.
    await expect(saveTurn(turn('s59', 0))).resolves.toBeDefined();

    // Podou pela metade e o turno novo entrou.
    expect(listSessions().length).toBeLessThanOrEqual(30);
    expect(listTurns('s59')).toHaveLength(1);
  });

  it('não lança quando o storage está negado por completo', async () => {
    vi.stubGlobal('localStorage', {
      length: 0,
      clear: () => {},
      key: () => null,
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new DOMException('insecure', 'SecurityError');
      },
    } as unknown as Storage);

    await expect(saveTurn(turn('s1', 0))).resolves.toBeDefined();
  });
});
