/**
 * localStorage que nunca lança exceção.
 *
 * Por que existe: o navegador lança em situações comuns e fora do nosso
 * controle, e cada uma delas já derrubava o app inteiro.
 *  - Acesso bloqueado: Safari em navegação privada, escudos do Brave e
 *    "bloquear dados de sites" fazem até `window.localStorage` lançar — e o
 *    provider de i18n lia uma chave durante o render, então o app não arrancava
 *    (tela branca, sem mensagem).
 *  - Cota cheia: `setItem` lança QuotaExceededError por volta de 5 MB por
 *    origem. O histórico de calls cresce para sempre, então salvar uma call nova
 *    quebrava por causa das calls antigas.
 *
 * Contrato: toda função aqui degrada para no-op em vez de lançar. Um navegador
 * com storage negado continua treinando calls — só não lembra de nada depois.
 * `setItem` devolve `false` quando não conseguiu persistir, para quem chama
 * poder reagir (ver `pruneHistory` em lib/storage.ts).
 */

/**
 * Resolve o storage subjacente, ou `null` se indisponível.
 *
 * Não memoiza de propósito: é só um acesso a propriedade, e manter sem cache
 * deixa o módulo testável (os testes trocam `globalThis.localStorage`).
 */
function backing(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // O próprio acesso à propriedade lança quando os dados do site estão bloqueados.
    return null;
  }
}

/** Lê uma chave. Devolve `null` se ausente ou se o storage não está acessível. */
export function getItem(key: string): string | null {
  try {
    return backing()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Grava uma chave. Devolve `true` só se realmente persistiu. */
export function setItem(key: string, value: string): boolean {
  try {
    const ls = backing();
    if (!ls) return false;
    ls.setItem(key, value);
    return true;
  } catch {
    // Cota estourada ou storage bloqueado — quem chama decide o que fazer.
    return false;
  }
}

/** Remove uma chave. Silencioso: não há nada a fazer se falhar. */
export function removeItem(key: string): void {
  try {
    backing()?.removeItem(key);
  } catch {
    /* nada a fazer */
  }
}

/** Lê e faz JSON.parse de uma chave, com fallback se ausente ou corrompida. */
export function getJson<T>(key: string, fallback: T): T {
  const raw = getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Serializa e grava. Devolve `true` só se realmente persistiu. */
export function setJson(key: string, value: unknown): boolean {
  try {
    return setItem(key, JSON.stringify(value));
  } catch {
    // JSON.stringify lança em referência circular / BigInt.
    return false;
  }
}

const PROBE_KEY = '__act_probe__';

/**
 * Testa de verdade se é possível escrever (feature detection não basta: o
 * objeto pode existir e ainda assim recusar gravações).
 */
export function isAvailable(): boolean {
  if (!setItem(PROBE_KEY, '1')) return false;
  removeItem(PROBE_KEY);
  return true;
}
