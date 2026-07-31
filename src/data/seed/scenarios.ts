import type { Scenario } from '@/types';

/** Time limits per call type (spec §10). */
export const TIME_LIMITS: Record<Scenario['call_type'], number> = {
  cold_call: 300,
  discovery: 600,
  demo: 900,
  negotiation: 600,
};

export const SEED_SCENARIOS: Scenario[] = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    persona_id: '00000000-0000-4000-8000-000000000202', // Paulo, Head of Sales
    product_id: '00000000-0000-4000-8000-000000000101', // Sales Cloud
    call_type: 'cold_call',
    difficulty: 2,
    language: 'pt-BR',
    time_limit_seconds: TIME_LIMITS.cold_call,
    success_criteria: 'Book a 30-minute discovery call with a concrete date and time.',
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
      'Survive the skepticism, connect the forecasting pain to the product, and book 20 minutes with the CFO or her referral.',
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
      'Map the 3 sales-process pains, quantify the impact of at least one, and leave with a next step booked.',
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
      'Uncover the customer-service pains, learn who decides (the COO), and secure a meeting with Giulia + COO.',
  },
  {
    id: '00000000-0000-4000-8000-000000000305',
    persona_id: '00000000-0000-4000-8000-000000000206', // Mr. Bianchi, Owner
    product_id: '00000000-0000-4000-8000-000000000101', // Sales Cloud
    call_type: 'cold_call',
    difficulty: 5,
    language: 'it-IT',
    time_limit_seconds: TIME_LIMITS.cold_call,
    success_criteria:
      'Avoid getting hung up on, earn trust, and get permission to call back or visit the company.',
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
      'Grab attention in the first 30 seconds, escape the "send me an email" brush-off, and book 15 minutes.',
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
      'Demonstrate the value for repetitive tickets, handle the budget objection, and define next steps with the COO.',
  },
];
