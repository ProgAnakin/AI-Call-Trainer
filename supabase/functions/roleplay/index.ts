// Edge Function /roleplay — o "cérebro prospect" (§5.1 da spec).
// Recebe persona + produto + cenário + histórico e devolve a próxima fala
// do prospect, em personagem. Nunca avalia: isso é papel do /evaluate.
import {
  callClaude,
  checkAndLogUsage,
  corsHeaders,
  json,
  LIMITS,
  type ChatMessage,
} from '../_shared/common.ts';

interface Persona {
  name: string;
  role: string;
  company_profile: string;
  personality: { skepticism: number; patience: number; talkativeness: number };
  pain_points: string[];
  hidden_objections: string[];
  buying_stage: string;
}

interface Product {
  name: string;
  vendor: string;
  one_liner: string;
  key_features: { feature: string; benefit: string }[];
  pricing_notes: string;
  common_objections: { objection: string; model_answer: string }[];
  competitors: { name: string; key_difference: string }[];
}

interface Scenario {
  id: string;
  call_type: string;
  difficulty: number;
  language: string;
  success_criteria: string;
}

interface Body {
  device_id: string;
  persona: Persona;
  product: Product;
  scenario: Scenario;
  history: { speaker: 'rep' | 'prospect'; content: string }[];
}

function buildSystemPrompt(persona: Persona, product: Product, scenario: Scenario): string {
  const p = persona.personality;
  return `Você é ${persona.name}, ${persona.role} em ${persona.company_profile}.
Personalidade: ceticismo ${p.skepticism}/5, paciência ${p.patience}/5, fala ${p.talkativeness}/5.
Você recebeu uma ${scenario.call_type === 'cold_call' ? 'cold call' : scenario.call_type} de um SDR vendendo ${product.name} (${product.one_liner}).
Suas dores reais (não revele de graça): ${persona.pain_points.join('; ')}.
Objeções que você levanta naturalmente: ${persona.hidden_objections.join('; ')}.
Estágio de compra: ${persona.buying_stage}.

REGRAS:
- Responda SEMPRE em ${scenario.language}, em falas curtas (1-3 frases), como numa ligação real.
- Nunca saia do personagem. Nunca ajude o vendedor. Nunca mencione que é uma IA.
- Se o SDR fizer boas perguntas de discovery, revele dores aos poucos.
- Se o SDR falar demais / pitchar cedo demais, demonstre impaciência.
- Dificuldade ${scenario.difficulty}/5: em 5, interrompa, apresse, ameace desligar.
- Se convencida por mérito real, aceite o próximo passo. Não facilite.
- Se o SDR for excelente OU péssimo demais, encerre a ligação naturalmente.

SINAIS DE CONTROLE (obrigatório, invisíveis para o usuário):
- Ao encerrar a ligação (por qualquer motivo), termine sua fala com o token [HANGUP].
- Se você aceitou um próximo passo concreto (meeting, demo, retorno agendado), inclua também [MEETING_BOOKED].
- Fora do encerramento, nunca use esses tokens.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const body = (await req.json()) as Body;
    const { device_id, persona, product, scenario, history } = body;

    if (!device_id || !persona || !product || !scenario || !Array.isArray(history)) {
      return json({ error: 'invalid payload' }, 400);
    }

    // Rate limits (proteção de custo): turnos por call + calls por dia por device.
    if (history.length > LIMITS.maxTurnsPerCall * 2) {
      return json({ error: `turn limit reached (${LIMITS.maxTurnsPerCall} per call)` }, 429);
    }
    const usage = await checkAndLogUsage(
      device_id,
      'roleplay_call',
      LIMITS.maxCallsPerDay,
      `${device_id}:${scenario.id}:${new Date().toISOString().slice(0, 10)}`,
    );
    if (!usage.ok) return json({ error: usage.reason }, 429);

    // Histórico da sessão → mensagens alternadas (rep = user, prospect = assistant).
    const messages: ChatMessage[] = history.map((t) => ({
      role: t.speaker === 'rep' ? 'user' : 'assistant',
      content: t.content,
    }));
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
      return json({ error: 'history must end with a rep turn' }, 400);
    }

    const reply = await callClaude({
      system: buildSystemPrompt(persona, product, scenario),
      messages,
      temperature: 0.8, // naturalidade
      maxTokens: 200, // falas curtas
    });

    return json({ reply });
  } catch (e) {
    console.error('roleplay error:', e);
    return json({ error: e instanceof Error ? e.message : 'internal error' }, 500);
  }
});
