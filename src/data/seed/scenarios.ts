import type { Scenario } from '@/types';

/** Time limits por tipo de call (§10 da spec). */
export const TIME_LIMITS: Record<Scenario['call_type'], number> = {
  cold_call: 300,
  discovery: 600,
  demo: 900,
  negotiation: 600,
};

export const SEED_SCENARIOS: Scenario[] = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    persona_id: '00000000-0000-4000-8000-000000000202', // Paulo, Head de Vendas
    product_id: '00000000-0000-4000-8000-000000000101', // Sales Cloud
    call_type: 'cold_call',
    difficulty: 2,
    language: 'pt-BR',
    time_limit_seconds: TIME_LIMITS.cold_call,
    success_criteria: 'Agendar uma discovery call de 30 minutos com data e hora concretas.',
  },
  {
    id: '00000000-0000-4000-8000-000000000302',
    persona_id: '00000000-0000-4000-8000-000000000201', // Marta, CFO
    product_id: '00000000-0000-4000-8000-000000000101', // Sales Cloud
    call_type: 'cold_call',
    difficulty: 4,
    language: 'pt-BR',
    time_limit_seconds: TIME_LIMITS.cold_call,
    success_criteria:
      'Sobreviver ao ceticismo, conectar a dor de forecast ao produto e agendar 20 minutos com a CFO ou indicação dela.',
  },
  {
    id: '00000000-0000-4000-8000-000000000303',
    persona_id: '00000000-0000-4000-8000-000000000202', // Paulo
    product_id: '00000000-0000-4000-8000-000000000101', // Sales Cloud
    call_type: 'discovery',
    difficulty: 3,
    language: 'pt-BR',
    time_limit_seconds: TIME_LIMITS.discovery,
    success_criteria:
      'Mapear as 3 dores do processo comercial, quantificar impacto de pelo menos uma e sair com próximo passo agendado.',
  },
  {
    id: '00000000-0000-4000-8000-000000000304',
    persona_id: '00000000-0000-4000-8000-000000000203', // Giulia
    product_id: '00000000-0000-4000-8000-000000000103', // Service Cloud
    call_type: 'discovery',
    difficulty: 2,
    language: 'it-IT',
    time_limit_seconds: TIME_LIMITS.discovery,
    success_criteria:
      'Scoprire i dolori del customer service, capire chi decide (COO) e ottenere un incontro con Giulia + COO.',
  },
  {
    id: '00000000-0000-4000-8000-000000000305',
    persona_id: '00000000-0000-4000-8000-000000000206', // Sr. Bianchi
    product_id: '00000000-0000-4000-8000-000000000101', // Sales Cloud
    call_type: 'cold_call',
    difficulty: 5,
    language: 'it-IT',
    time_limit_seconds: TIME_LIMITS.cold_call,
    success_criteria:
      'Non farsi riattaccare in faccia, guadagnare fiducia e ottenere il permesso di richiamare o visitare l’azienda.',
  },
  {
    id: '00000000-0000-4000-8000-000000000306',
    persona_id: '00000000-0000-4000-8000-000000000204', // Ricardo, CEO
    product_id: '00000000-0000-4000-8000-000000000104', // Slack
    call_type: 'cold_call',
    difficulty: 4,
    language: 'pt-PT',
    time_limit_seconds: TIME_LIMITS.cold_call,
    success_criteria:
      'Prender a atenção nos primeiros 30 segundos, escapar do “manda um e-mail” e agendar 15 minutos.',
  },
  {
    id: '00000000-0000-4000-8000-000000000307',
    persona_id: '00000000-0000-4000-8000-000000000205', // Ana, IT Director
    product_id: '00000000-0000-4000-8000-000000000102', // Agentforce
    call_type: 'discovery',
    difficulty: 3,
    language: 'en-US',
    time_limit_seconds: TIME_LIMITS.discovery,
    success_criteria:
      'Uncover integration and compliance concerns, position Agentforce guardrails, and book a technical deep-dive.',
  },
  {
    id: '00000000-0000-4000-8000-000000000308',
    persona_id: '00000000-0000-4000-8000-000000000203', // Giulia
    product_id: '00000000-0000-4000-8000-000000000102', // Agentforce
    call_type: 'demo',
    difficulty: 3,
    language: 'it-IT',
    time_limit_seconds: TIME_LIMITS.demo,
    success_criteria:
      'Dimostrare il valore per i ticket ripetitivi, gestire l’obiezione del budget e definire i prossimi passi con il COO.',
  },
];
