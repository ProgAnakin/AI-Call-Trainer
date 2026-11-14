import { afterEach, describe, expect, it, vi } from 'vitest';
import * as safeStorage from './safeStorage';

/** localStorage em memória — suficiente para o ambiente node dos testes. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

/** Storage que lança em tudo — Safari privado / escudos do Brave. */
function blockedStorage(): Storage {
  const boom = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  return {
    length: 0,
    clear: boom,
    getItem: boom,
    key: boom,
    removeItem: boom,
    setItem: boom,
  } as unknown as Storage;
}

/** Storage cheio: lê normal, mas toda gravação estoura a cota. */
function fullStorage(): Storage {
  const base = memoryStorage();
  return {
    ...base,
    getItem: base.getItem,
    setItem: () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    },
  } as unknown as Storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safeStorage com storage funcional', () => {
  it('faz round trip de string', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(safeStorage.setItem('k', 'v')).toBe(true);
    expect(safeStorage.getItem('k')).toBe('v');
    safeStorage.removeItem('k');
    expect(safeStorage.getItem('k')).toBeNull();
  });

  it('faz round trip de JSON e reporta disponibilidade', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(safeStorage.setJson('j', { a: [1, 2] })).toBe(true);
    expect(safeStorage.getJson('j', null)).toEqual({ a: [1, 2] });
    expect(safeStorage.isAvailable()).toBe(true);
  });

  it('não deixa a chave de sondagem para trás', () => {
    const store = memoryStorage();
    vi.stubGlobal('localStorage', store);
    safeStorage.isAvailable();
    expect(store.length).toBe(0);
  });

  it('cai no fallback com JSON corrompido em vez de lançar', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    safeStorage.setItem('j', '{nao é json');
    expect(safeStorage.getJson('j', { ok: true })).toEqual({ ok: true });
  });

  it('cai no fallback com chave ausente', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(safeStorage.getJson('ausente', 42)).toBe(42);
  });

  it('devolve false em valor não serializável', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(safeStorage.setJson('c', circular)).toBe(false);
  });
});

describe('safeStorage com storage bloqueado', () => {
  it('degrada sem lançar quando todo método lança', () => {
    vi.stubGlobal('localStorage', blockedStorage());
    expect(() => safeStorage.getItem('k')).not.toThrow();
    expect(safeStorage.getItem('k')).toBeNull();
    expect(safeStorage.setItem('k', 'v')).toBe(false);
    expect(() => safeStorage.removeItem('k')).not.toThrow();
    expect(safeStorage.getJson('k', 'fb')).toBe('fb');
    expect(safeStorage.isAvailable()).toBe(false);
  });

  it('degrada quando o PRÓPRIO acesso a globalThis.localStorage lança', () => {
    // Este é o caso que derrubava o boot: o provider de i18n lia uma chave
    // dentro de um inicializador de estado, então a exceção vinha no primeiro
    // render e o app nunca aparecia.
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access is denied for this document.', 'SecurityError');
      },
    });
    try {
      expect(() => safeStorage.getItem('act.ui_lang')).not.toThrow();
      expect(safeStorage.getItem('act.ui_lang')).toBeNull();
      expect(safeStorage.setItem('act.ui_lang', 'pt')).toBe(false);
      expect(safeStorage.isAvailable()).toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
      else delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it('degrada quando não existe localStorage algum', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(safeStorage.getItem('k')).toBeNull();
    expect(safeStorage.setItem('k', 'v')).toBe(false);
    expect(safeStorage.isAvailable()).toBe(false);
  });
});

describe('safeStorage com cota estourada', () => {
  it('devolve false na gravação mas continua lendo', () => {
    const store = fullStorage();
    vi.stubGlobal('localStorage', store);
    expect(safeStorage.setItem('k', 'v')).toBe(false);
    expect(safeStorage.setJson('k', { a: 1 })).toBe(false);
    expect(() => safeStorage.getItem('k')).not.toThrow();
  });
});
