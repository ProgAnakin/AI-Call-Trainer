import type { Product } from '@/types';

/**
 * Fixed IDs (same UUIDs as the SQL seed in supabase/migrations) so the local
 * mode and the Supabase mode share the same references.
 */
export const SEED_PRODUCTS: Product[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    name: 'Sales Cloud',
    vendor: 'Salesforce',
    one_liner:
      'The #1 CRM on the market: pipeline, sales forecasting and automation in one place, with built-in AI.',
    key_features: [
      {
        feature: 'Unified pipeline management',
        benefit: 'Every deal visible in one funnel — nothing gets lost in spreadsheets.',
      },
      {
        feature: 'AI forecasting (Einstein)',
        benefit: 'Close predictions based on real data, not the manager’s gut feeling.',
      },
      {
        feature: 'Task and cadence automation',
        benefit: 'Reps spend time selling, not updating fields and sending manual follow-ups.',
      },
      {
        feature: 'Real-time reports and dashboards',
        benefit: 'Managers see the funnel bottleneck instantly, without waiting for month-end.',
      },
      {
        feature: 'AppExchange (5,000+ integrations)',
        benefit: 'Connects to the stack the company already uses, from the ERP to WhatsApp.',
      },
    ],
    pricing_notes:
      'Per user/month: Starter ~€25, Pro ~€100, Enterprise ~€165. Annual contract. Implementation is a separate cost.',
    common_objections: [
      {
        objection: 'It is too expensive for our size.',
        model_answer:
          'Compared to what? How much does one deal lost to a forgotten follow-up cost? Starter is less than a daily lunch per rep.',
      },
      {
        objection: 'We use spreadsheets and it works.',
        model_answer:
          'It works until the day a rep leaves and takes the history with them. How many deals live in a single person’s head today?',
      },
      {
        objection: 'Implementation is long and complex.',
        model_answer:
          'Starter runs in days, not months. The complexity comes as the operation grows — and that is a sign it paid off.',
      },
      {
        objection: 'My team will not adopt yet another tool.',
        model_answer:
          'Adoption is a process problem, not a tool problem. That is why the rollout starts with the flow the team already does — just automated.',
      },
      {
        objection: 'We already have HubSpot / another CRM.',
        model_answer:
          'Great — what is missing in it today? We usually hear forecasting and customization. That is exactly where Sales Cloud is strongest.',
      },
    ],
    competitors: [
      {
        name: 'HubSpot',
        key_difference:
          'HubSpot is simpler and cheaper to start; Sales Cloud scales better on customization, forecasting and the enterprise ecosystem.',
      },
      {
        name: 'Microsoft Dynamics 365',
        key_difference:
          'Dynamics appeals to those already living in the Microsoft ecosystem; Salesforce has a more mature sales UX and the largest app marketplace.',
      },
      {
        name: 'Pipedrive',
        key_difference:
          'Pipedrive is great for small pipeline-focused teams; it does not keep up on advanced automation, AI and governance.',
      },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    name: 'Agentforce',
    vendor: 'Salesforce',
    one_liner:
      'Autonomous AI agents that serve, qualify and resolve — plugged into your CRM data, 24/7.',
    key_features: [
      {
        feature: 'Autonomous agents with guardrails',
        benefit: 'Resolves cases end to end without a human, but within limits you define.',
      },
      {
        feature: 'Trained on your Salesforce data',
        benefit: 'Answers with real customer context, not generic chatbot replies.',
      },
      {
        feature: 'Smart handoff to humans',
        benefit: 'When a case is complex, it hands over to the team with the full history summarized.',
      },
      {
        feature: 'Low-code builder (Agent Builder)',
        benefit: 'Ops creates and tunes agents without depending on engineering.',
      },
      {
        feature: 'Serves across channels and languages',
        benefit: 'One agent covers web, WhatsApp and email in PT/EN/IT without tripling the team.',
      },
    ],
    pricing_notes:
      'Per-conversation model (~$2/conversation at launch) or credit packs. Requires Salesforce as the data foundation.',
    common_objections: [
      {
        objection: 'The AI will say something dumb to my customer.',
        model_answer:
          'That is why guardrails and a closed scope exist: the agent only acts on topics and actions you approved, with full audit logs.',
      },
      {
        objection: 'We tried a chatbot and it was terrible.',
        model_answer:
          'A decision-tree chatbot ≠ an agent with CRM context. The difference is resolving the case, not redirecting to an FAQ.',
      },
      {
        objection: 'Paying per conversation gets expensive at scale.',
        model_answer:
          'Compare it to the cost per human interaction (€3–8). The agent handles the repetitive ones and the team focuses on high-value cases.',
      },
      {
        objection: 'My team will think they are being replaced.',
        model_answer:
          'The first cases are the ones nobody wants: overnight, weekends, repeated questions. The team levels up, it does not leave.',
      },
      {
        objection: 'We do not have organized data for this.',
        model_answer:
          'That is the most common case. The rollout starts with a small, well-documented scope — and it exposes exactly where the data needs to improve.',
      },
    ],
    competitors: [
      {
        name: 'Microsoft Copilot Studio',
        key_difference:
          'Strong in the Office ecosystem; Agentforce wins when the customer data already lives in Salesforce.',
      },
      {
        name: 'Intercom Fin',
        key_difference:
          'Fin is excellent for SaaS support; Agentforce covers sales + service + marketing over the same CRM.',
      },
      {
        name: 'Custom chatbots (OpenAI/Claude directly)',
        key_difference:
          'A custom build gives flexibility, but you own the infra, security and integration. Agentforce ships that ready and auditable.',
      },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    name: 'Service Cloud',
    vendor: 'Salesforce',
    one_liner:
      'Omnichannel customer service platform: every channel, the full customer history and AI in one console.',
    key_features: [
      {
        feature: 'Unified omnichannel console',
        benefit: 'Agents see the customer’s email, chat, phone and WhatsApp on a single screen.',
      },
      {
        feature: 'Smart case routing',
        benefit: 'The right case to the right agent — SLAs stop blowing up from manual distribution.',
      },
      {
        feature: 'Integrated knowledge base',
        benefit: 'Consistent answers and self-service that cuts ticket volume.',
      },
      {
        feature: 'Einstein for service',
        benefit: 'Automatic case summaries, reply suggestions and classification without typing.',
      },
      {
        feature: 'Real-time CSAT/SLA reports',
        benefit: 'Managers see the queue, response time and satisfaction without building a spreadsheet.',
      },
    ],
    pricing_notes:
      'Per user/month: Starter ~€25 up to Enterprise ~€165. Channel add-ons (voice, WhatsApp) billed separately.',
    common_objections: [
      {
        objection: 'Zendesk does the same and is cheaper.',
        model_answer:
          'For simple tickets, yes. The difference shows when support needs the sales context: in Service Cloud the history is the same CRM.',
      },
      {
        objection: 'Our volume does not justify it.',
        model_answer:
          'What does a customer who churns over bad support cost? The ROI rarely comes from volume, it comes from retention.',
      },
      {
        objection: 'Migrating the old tickets is unfeasible.',
        model_answer:
          'Migration is phased: new channels go first, the legacy stays read-only. Nobody loses history.',
      },
      {
        objection: 'My team barely uses the current system.',
        model_answer:
          'A classic sign of a tool that gets in the way instead of helping. Adoption improves when the system removes work instead of creating it.',
      },
      {
        objection: 'AI in support will annoy the customer.',
        model_answer:
          'Badly implemented AI, yes. Here it summarizes, suggests and routes — the customer still talks to a person, just a faster one.',
      },
    ],
    competitors: [
      {
        name: 'Zendesk',
        key_difference:
          'Zendesk is faster to deploy; Service Cloud wins on a 360º view of the customer and integration with sales.',
      },
      {
        name: 'Freshdesk',
        key_difference:
          'Freshdesk competes on price; Service Cloud delivers governance and enterprise scale.',
      },
      {
        name: 'Intercom',
        key_difference:
          'Intercom shines in chat/SaaS product; Service Cloud covers full service operations including voice and field service.',
      },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000104',
    name: 'Slack',
    vendor: 'Salesforce',
    one_liner:
      'The company’s digital HQ: channel-based communication, integrations with the whole stack, and no-code automation.',
    key_features: [
      {
        feature: 'Channels organized by project/topic',
        benefit: 'The end of internal email: context stays public, searchable, and the right people join.',
      },
      {
        feature: 'Huddles (instant audio/video)',
        benefit: 'Solves in 5 minutes what would become a 30-minute meeting on the calendar.',
      },
      {
        feature: 'No-code Workflow Builder',
        benefit: 'Onboarding, approvals and alerts automated without depending on IT.',
      },
      {
        feature: '2,600+ integrations (Google, Jira, Salesforce...)',
        benefit: 'Notifications and actions from other systems happen where the team already is.',
      },
      {
        feature: 'Slack Connect with external partners',
        benefit: 'Customer and vendor in the same secure channel — no endless email thread.',
      },
    ],
    pricing_notes:
      'Limited free tier (90 days of history). Pro ~€7.25/user/month, Business+ ~€12.50. Enterprise on request.',
    common_objections: [
      {
        objection: 'We already have Microsoft Teams in the package.',
        model_answer:
          '"Included" is not "used". Ask the team where the real conversation happens. Slack wins on UX, search and integrations.',
      },
      {
        objection: 'Slack becomes distraction and noise.',
        model_answer:
          'Noise is culture, not the tool. Well-designed channels + configured notifications create less interruption than email.',
      },
      {
        objection: 'It is expensive for a chat tool.',
        model_answer:
          'Chat is 20% of the value. The rest is searching company knowledge, automation and integration — what does the information lost today cost?',
      },
      {
        objection: 'Security/compliance will not approve it.',
        model_answer:
          'Slack has enterprise certifications (SOC 2, ISO 27001, HIPAA on the right plan) and retention/DLP controls. What does compliance require?',
      },
      {
        objection: 'The team will resist changing habits.',
        model_answer:
          'Migrate by pilot team: one champion team proves the value in 2 weeks and the rest ask to join.',
      },
    ],
    competitors: [
      {
        name: 'Microsoft Teams',
        key_difference:
          'Teams comes "free" with Microsoft 365; Slack wins on experience, speed, search and app ecosystem.',
      },
      {
        name: 'Google Chat',
        key_difference:
          'Google Chat is basic and serves those living in Workspace; Slack is a work platform, not just chat.',
      },
      {
        name: 'Discord',
        key_difference:
          'Discord dominates communities; it lacks Slack’s corporate controls, compliance and B2B integrations.',
      },
    ],
  },
];
