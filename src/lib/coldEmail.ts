import type { UiLanguage } from '@/types';

/**
 * Cold Email Analyzer — heurística determinística, sem custo de API (mesma
 * filosofia do drill de objeções). Avalia um cold email nas dimensões que mais
 * pesam na resposta de um prospect e devolve nota + checagens + dicas.
 *
 * Multilíngue por aproximação: usa os léxicos do idioma da UI. Não é um
 * corretor perfeito — é um treinador de bons hábitos de copy.
 */

export interface EmailInput {
  subject: string;
  body: string;
  lang: UiLanguage;
}

export interface EmailCheck {
  key: string;
  pass: boolean;
}

export interface EmailAnalysis {
  score: number; // 0-100
  wordCount: number;
  checks: EmailCheck[];
  /** Chaves i18n de dicas acionáveis, mais impactante primeiro. */
  tips: string[];
}

/** Faixa ideal de tamanho de um cold email (palavras). */
const MIN_WORDS = 40;
const MAX_WORDS = 130;
const MAX_SUBJECT_CHARS = 60;

const CTA: Record<UiLanguage, string[]> = {
  en: ['call', 'meet', 'chat', 'demo', 'schedule', 'book', 'available', 'connect', 'open to', 'worth a', '15 min', '20 min', 'quick call', 'next week', 'thursday', 'friday'],
  pt: ['ligar', 'ligação', 'ligacao', 'reunião', 'reuniao', 'conversa', 'bate-papo', 'agenda', 'agendar', 'disponível', 'disponivel', 'aberto a', 'vale', '15 min', '20 min', 'semana que vem', 'quinta', 'sexta', 'call'],
  it: ['chiamata', 'incontro', 'call', 'demo', 'fissare', 'agenda', 'disponibile', 'aperto a', 'due parole', '15 min', '20 min', 'settimana prossima', 'giovedì', 'venerdì'],
};

const SPAM: Record<UiLanguage, string[]> = {
  en: ['free', 'guarantee', 'guaranteed', 'act now', 'click here', 'limited time', 'buy now', 'risk-free', '100%', '$$$', 'cheap', 'urgent', 'winner', 'congratulations', 'no obligation', 'best price', 'amazing offer'],
  pt: ['grátis', 'gratis', 'garantido', 'garantia', 'clique aqui', 'oferta imperdível', 'oferta imperdivel', 'promoção', 'promocao', 'urgente', 'imperdível', 'imperdivel', 'desconto', 'melhor preço', 'melhor preco', 'sem compromisso', 'ganhe', '100%'],
  it: ['gratis', 'gratuito', 'garantito', 'clicca qui', 'offerta', 'sconto', 'urgente', 'affare', 'senza impegno', 'miglior prezzo', 'vinci', '100%'],
};

const CLICHE: Record<UiLanguage, string[]> = {
  en: ['i hope this email finds you well', 'i hope you are doing well', 'i hope this finds you well', 'to whom it may concern', 'dear sir or madam', 'my name is'],
  pt: ['espero que esteja bem', 'espero que este e-mail o encontre bem', 'espero que este email o encontre bem', 'a quem possa interessar', 'meu nome é', 'me chamo', 'venho por meio deste'],
  it: ['spero che questa email la trovi bene', 'spero stia bene', 'a chi di competenza', 'mi chiamo', 'il mio nome è', 'gentile signore o signora'],
};

const YOU: Record<UiLanguage, string[]> = {
  en: ['you', 'your', "you're", 'yours'],
  pt: ['você', 'voce', 'vocês', 'voces', 'seu', 'sua', 'seus', 'suas', 'te', 'vc'],
  it: ['tu', 'lei', 'voi', 'suo', 'sua', 'tuo', 'tua', 'vostro', 'vostra', 'ti'],
};

const WE: Record<UiLanguage, string[]> = {
  en: ['i', 'we', 'my', 'our', 'me', 'us', "i'm", "we're", 'myself'],
  pt: ['eu', 'nós', 'nos', 'meu', 'minha', 'meus', 'minhas', 'nosso', 'nossa', 'nossos', 'nossas'],
  it: ['io', 'noi', 'mio', 'mia', 'miei', 'nostro', 'nostra', 'nostri', 'ci'],
};

function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Conta quantas palavras do texto estão no conjunto `tokens`.
 *
 * Tokeniza uma vez e consulta um Set: exato (um regex global com delimitadores
 * consumia o separador e perdia ocorrências consecutivas, ex. "you you you"
 * contava 2) e linear, em vez de compilar um regex por token.
 */
function countTokens(text: string, tokens: string[]): number {
  const set = new Set(tokens.filter((t) => !t.includes(' ')));
  // Normaliza a apóstrofe tipográfica (’) para casar "you're"/"l'idea".
  const wordsInText = text.toLowerCase().replaceAll('’', "'").match(/[\p{L}']+/gu) ?? [];
  return wordsInText.reduce((n, w) => (set.has(w) ? n + 1 : n), 0);
}

function hasAny(text: string, phrases: string[]): boolean {
  const lower = text.toLowerCase();
  return phrases.some((p) => lower.includes(p));
}

/** Analisa um cold email e devolve nota 0-100 + checagens + dicas. */
export function analyzeEmail(input: EmailInput): EmailAnalysis {
  const { subject, body, lang } = input;
  const wordList = words(body);
  const wordCount = wordList.length;

  const conciseOk = wordCount >= MIN_WORDS && wordCount <= MAX_WORDS;
  const subjectOk =
    subject.trim().length >= 3 && subject.trim().length <= MAX_SUBJECT_CHARS;
  const ctaOk = body.includes('?') || hasAny(body, CTA[lang]);
  const youCount = countTokens(body, YOU[lang]);
  const weCount = countTokens(body, WE[lang]);
  const youFocusedOk = youCount >= weCount && youCount > 0;
  const spamOk = !hasAny(`${subject} ${body}`, SPAM[lang]);
  const clicheOk = !hasAny(body, CLICHE[lang]);
  const exclaims = (body.match(/!/g) ?? []).length;
  const exclaimOk = exclaims <= 1;

  const weighted: { check: EmailCheck; weight: number }[] = [
    { check: { key: 'concise', pass: conciseOk }, weight: 25 },
    { check: { key: 'subject', pass: subjectOk }, weight: 10 },
    { check: { key: 'cta', pass: ctaOk }, weight: 20 },
    { check: { key: 'youFocused', pass: youFocusedOk }, weight: 15 },
    { check: { key: 'noSpam', pass: spamOk }, weight: 15 },
    { check: { key: 'noCliche', pass: clicheOk }, weight: 10 },
    { check: { key: 'lowExclaim', pass: exclaimOk }, weight: 5 },
  ];

  // Empty body: score 0, single tip.
  if (wordCount === 0) {
    return {
      score: 0,
      wordCount: 0,
      checks: weighted.map((w) => ({ ...w.check, pass: false })),
      tips: ['email.tip.empty'],
    };
  }

  const score = weighted.reduce((s, w) => s + (w.check.pass ? w.weight : 0), 0);

  // Dicas contextuais (mais impactante primeiro).
  const tips: string[] = [];
  if (!conciseOk) tips.push(wordCount < MIN_WORDS ? 'email.tip.tooShort' : 'email.tip.tooLong');
  if (!ctaOk) tips.push('email.tip.cta');
  if (!youFocusedOk) tips.push('email.tip.youFocused');
  if (!spamOk) tips.push('email.tip.spam');
  if (!clicheOk) tips.push('email.tip.cliche');
  if (!subjectOk) tips.push('email.tip.subject');
  if (!exclaimOk) tips.push('email.tip.exclaim');
  if (tips.length === 0) tips.push('email.tip.solid');

  return { score, wordCount, checks: weighted.map((w) => w.check), tips: tips.slice(0, 4) };
}

// ---------- Best-score persistence (espelha o drill) ----------

const BEST_KEY = 'act.email.best';

export function getEmailBest(): number | null {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw !== null && !Number.isNaN(Number(raw)) ? Number(raw) : null;
  } catch {
    return null;
  }
}

/** Salva se for recorde. Retorna true se bateu um recorde anterior. */
export function saveEmailBest(score: number): boolean {
  try {
    const prev = getEmailBest();
    if (prev !== null && prev >= score) return false;
    localStorage.setItem(BEST_KEY, String(score));
    return prev !== null;
  } catch {
    return false;
  }
}
