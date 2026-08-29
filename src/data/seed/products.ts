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
        i18n: {
          pt: {
            objection: 'É caro demais para o nosso tamanho.',
            model_answer:
              'Caro comparado a quê? Quanto custa um deal perdido por follow-up esquecido? O Starter sai menos que um almoço por dia por vendedor.',
          },
          it: {
            objection: 'È troppo caro per le nostre dimensioni.',
            model_answer:
              'Caro rispetto a cosa? Quanto costa una trattativa persa per un follow-up dimenticato? Starter costa meno di un pranzo al giorno per venditore.',
          },
        },
      },
      {
        objection: 'We use spreadsheets and it works.',
        model_answer:
          'It works until the day a rep leaves and takes the history with them. How many deals live in a single person’s head today?',
        i18n: {
          pt: {
            objection: 'A gente usa planilhas e funciona.',
            model_answer:
              'Funciona até o dia em que um vendedor sai e leva o histórico junto. Quantos deals hoje estão só na cabeça de uma pessoa?',
          },
          it: {
            objection: 'Usiamo i fogli di calcolo e funziona.',
            model_answer:
              'Funziona finché un venditore se ne va e si porta via lo storico. Quante trattative oggi vivono solo nella testa di una persona?',
          },
        },
      },
      {
        objection: 'Implementation is long and complex.',
        model_answer:
          'Starter runs in days, not months. The complexity comes as the operation grows — and that is a sign it paid off.',
        i18n: {
          pt: {
            objection: 'A implementação é longa e complexa.',
            model_answer:
              'O Starter roda em dias, não meses. A complexidade só aparece quando a operação cresce — e aí é sinal de que valeu a pena.',
          },
          it: {
            objection: 'L’implementazione è lunga e complessa.',
            model_answer:
              'Starter parte in giorni, non mesi. La complessità arriva quando l’operazione cresce — ed è il segno che è valsa la pena.',
          },
        },
      },
      {
        objection: 'My team will not adopt yet another tool.',
        model_answer:
          'Adoption is a process problem, not a tool problem. That is why the rollout starts with the flow the team already does — just automated.',
        i18n: {
          pt: {
            objection: 'Meu time não vai adotar mais uma ferramenta.',
            model_answer:
              'Adoção é problema de processo, não de ferramenta. Por isso o rollout começa pelo fluxo que o time já faz — só que automatizado.',
          },
          it: {
            objection: 'Il mio team non adotterà l’ennesimo strumento.',
            model_answer:
              'L’adozione è un problema di processo, non di strumento. Per questo il rollout parte dal flusso che il team già fa — solo automatizzato.',
          },
        },
      },
      {
        objection: 'We already have HubSpot / another CRM.',
        model_answer:
          'Great — what is missing in it today? We usually hear forecasting and customization. That is exactly where Sales Cloud is strongest.',
        i18n: {
          pt: {
            objection: 'A gente já tem HubSpot / outro CRM.',
            model_answer:
              'Ótimo — o que falta nele hoje? Normalmente ouvimos previsão de vendas e customização. É exatamente onde o Sales Cloud é mais forte.',
          },
          it: {
            objection: 'Abbiamo già HubSpot / un altro CRM.',
            model_answer:
              'Ottimo — cosa manca oggi? Di solito ci dicono forecasting e personalizzazione. È esattamente dove Sales Cloud è più forte.',
          },
        },
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
        i18n: {
          pt: {
            objection: 'A IA vai falar besteira para o meu cliente.',
            model_answer:
              'Por isso existem guardrails e escopo fechado: o agente só age nos temas e ações que você aprovou, com auditoria completa.',
          },
          it: {
            objection: 'L’IA dirà una sciocchezza al mio cliente.',
            model_answer:
              'Per questo esistono guardrail e ambito chiuso: l’agente agisce solo su temi e azioni che lei ha approvato, con audit completo.',
          },
        },
      },
      {
        objection: 'We tried a chatbot and it was terrible.',
        model_answer:
          'A decision-tree chatbot ≠ an agent with CRM context. The difference is resolving the case, not redirecting to an FAQ.',
        i18n: {
          pt: {
            objection: 'A gente testou chatbot e foi péssimo.',
            model_answer:
              'Chatbot de árvore de decisão não é a mesma coisa que um agente com o contexto do CRM. A diferença é resolver o caso, não empurrar para o FAQ.',
          },
          it: {
            objection: 'Abbiamo provato un chatbot ed è stato pessimo.',
            model_answer:
              'Un chatbot ad albero decisionale non è un agente con il contesto del CRM. La differenza è risolvere il caso, non rimandare alle FAQ.',
          },
        },
      },
      {
        objection: 'Paying per conversation gets expensive at scale.',
        model_answer:
          'Compare it to the cost per human interaction (€3–8). The agent handles the repetitive ones and the team focuses on high-value cases.',
        i18n: {
          pt: {
            objection: 'Pagar por conversa fica caro em escala.',
            model_answer:
              'Compare com o custo por atendimento humano (€3–8). O agente resolve os repetitivos e o time foca nos casos de valor.',
          },
          it: {
            objection: 'Pagare a conversazione diventa caro su larga scala.',
            model_answer:
              'Lo confronti con il costo per contatto umano (3–8 €). L’agente gestisce i ripetitivi e il team si concentra sui casi di valore.',
          },
        },
      },
      {
        objection: 'My team will think they are being replaced.',
        model_answer:
          'The first cases are the ones nobody wants: overnight, weekends, repeated questions. The team levels up, it does not leave.',
        i18n: {
          pt: {
            objection: 'Meu time vai achar que será substituído.',
            model_answer:
              'Os primeiros casos são os que ninguém quer: madrugada, fim de semana, pergunta repetida. O time sobe de nível, não sai.',
          },
          it: {
            objection: 'Il mio team penserà di essere sostituito.',
            model_answer:
              'I primi casi sono quelli che nessuno vuole: notte, weekend, domande ripetute. Il team cresce di livello, non se ne va.',
          },
        },
      },
      {
        objection: 'We do not have organized data for this.',
        model_answer:
          'That is the most common case. The rollout starts with a small, well-documented scope — and it exposes exactly where the data needs to improve.',
        i18n: {
          pt: {
            objection: 'A gente não tem dado organizado para isso.',
            model_answer:
              'É o caso mais comum. O rollout começa com um escopo pequeno e bem documentado — e expõe exatamente onde o dado precisa melhorar.',
          },
          it: {
            objection: 'Non abbiamo dati organizzati per questo.',
            model_answer:
              'È il caso più comune. Il rollout parte da un ambito piccolo e ben documentato — e mostra esattamente dove i dati devono migliorare.',
          },
        },
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
        i18n: {
          pt: {
            objection: 'O Zendesk faz o mesmo e é mais barato.',
            model_answer:
              'Para ticket simples, sim. A diferença aparece quando o atendimento precisa do contexto de vendas: no Service Cloud o histórico é o mesmo CRM.',
          },
          it: {
            objection: 'Zendesk fa lo stesso e costa meno.',
            model_answer:
              'Per i ticket semplici, sì. La differenza emerge quando il servizio ha bisogno del contesto commerciale: in Service Cloud lo storico è lo stesso CRM.',
          },
        },
      },
      {
        objection: 'Our volume does not justify it.',
        model_answer:
          'What does a customer who churns over bad support cost? The ROI rarely comes from volume, it comes from retention.',
        i18n: {
          pt: {
            objection: 'Nosso volume não justifica.',
            model_answer:
              'Quanto custa um cliente que cancela por atendimento ruim? O ROI raramente vem do volume, vem da retenção.',
          },
          it: {
            objection: 'Il nostro volume non lo giustifica.',
            model_answer:
              'Quanto costa un cliente che se ne va per un servizio scadente? Il ROI raramente viene dal volume, viene dalla retention.',
          },
        },
      },
      {
        objection: 'Migrating the old tickets is unfeasible.',
        model_answer:
          'Migration is phased: new channels go first, the legacy stays read-only. Nobody loses history.',
        i18n: {
          pt: {
            objection: 'Migrar os tickets antigos é inviável.',
            model_answer:
              'A migração é faseada: os canais novos entram primeiro e o legado fica em leitura. Ninguém perde histórico.',
          },
          it: {
            objection: 'Migrare i vecchi ticket è impraticabile.',
            model_answer:
              'La migrazione è per fasi: prima i canali nuovi, il legacy resta in sola lettura. Nessuno perde lo storico.',
          },
        },
      },
      {
        objection: 'My team barely uses the current system.',
        model_answer:
          'A classic sign of a tool that gets in the way instead of helping. Adoption improves when the system removes work instead of creating it.',
        i18n: {
          pt: {
            objection: 'Meu time mal usa o sistema atual.',
            model_answer:
              'Sinal clássico de ferramenta que atrapalha em vez de ajudar. A adoção melhora quando o sistema tira trabalho em vez de criar.',
          },
          it: {
            objection: 'Il mio team usa a malapena il sistema attuale.',
            model_answer:
              'Segnale classico di uno strumento che ostacola invece di aiutare. L’adozione migliora quando il sistema toglie lavoro invece di crearne.',
          },
        },
      },
      {
        objection: 'AI in support will annoy the customer.',
        model_answer:
          'Badly implemented AI, yes. Here it summarizes, suggests and routes — the customer still talks to a person, just a faster one.',
        i18n: {
          pt: {
            objection: 'IA no atendimento vai irritar o cliente.',
            model_answer:
              'IA mal implementada, sim. Aqui ela resume, sugere e roteia — o cliente continua falando com gente, só que gente mais rápida.',
          },
          it: {
            objection: 'L’IA nel servizio clienti irriterà i clienti.',
            model_answer:
              'L’IA fatta male, sì. Qui riassume, suggerisce e smista — il cliente parla sempre con una persona, solo più veloce.',
          },
        },
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
        i18n: {
          pt: {
            objection: 'A gente já tem o Microsoft Teams no pacote.',
            model_answer:
              '"Incluso" não é "usado". Pergunte ao time onde a conversa de verdade acontece. O Slack ganha em experiência, busca e integrações.',
          },
          it: {
            objection: 'Abbiamo già Microsoft Teams nel pacchetto.',
            model_answer:
              '"Incluso" non vuol dire "usato". Chieda al team dove avviene la conversazione vera. Slack vince su esperienza, ricerca e integrazioni.',
          },
        },
      },
      {
        objection: 'Slack becomes distraction and noise.',
        model_answer:
          'Noise is culture, not the tool. Well-designed channels + configured notifications create less interruption than email.',
        i18n: {
          pt: {
            objection: 'O Slack vira distração e ruído.',
            model_answer:
              'Ruído é cultura, não ferramenta. Canais bem desenhados com notificações configuradas interrompem menos que e-mail.',
          },
          it: {
            objection: 'Slack diventa distrazione e rumore.',
            model_answer:
              'Il rumore è cultura, non strumento. Canali ben progettati con notifiche configurate interrompono meno delle email.',
          },
        },
      },
      {
        objection: 'It is expensive for a chat tool.',
        model_answer:
          'Chat is 20% of the value. The rest is searching company knowledge, automation and integration — what does the information lost today cost?',
        i18n: {
          pt: {
            objection: 'É caro para uma ferramenta de chat.',
            model_answer:
              'O chat é 20% do valor. O resto é buscar o conhecimento da empresa, automação e integração — quanto custa a informação que se perde hoje?',
          },
          it: {
            objection: 'È caro per uno strumento di chat.',
            model_answer:
              'La chat è il 20% del valore. Il resto è cercare la conoscenza aziendale, automazione e integrazioni — quanto costa l’informazione che oggi si perde?',
          },
        },
      },
      {
        objection: 'Security/compliance will not approve it.',
        model_answer:
          'Slack has enterprise certifications (SOC 2, ISO 27001, HIPAA on the right plan) and retention/DLP controls. What does compliance require?',
        i18n: {
          pt: {
            objection: 'Segurança/compliance não vai aprovar.',
            model_answer:
              'O Slack tem certificações enterprise (SOC 2, ISO 27001, HIPAA no plano certo) e controles de retenção e DLP. O que o compliance exige?',
          },
          it: {
            objection: 'Sicurezza e compliance non lo approveranno.',
            model_answer:
              'Slack ha certificazioni enterprise (SOC 2, ISO 27001, HIPAA nel piano giusto) e controlli di retention e DLP. Cosa richiede la compliance?',
          },
        },
      },
      {
        objection: 'The team will resist changing habits.',
        model_answer:
          'Migrate by pilot team: one champion team proves the value in 2 weeks and the rest ask to join.',
        i18n: {
          pt: {
            objection: 'O time vai resistir a mudar de hábito.',
            model_answer:
              'Migre por time-piloto: um time campeão prova o valor em 2 semanas e o resto pede para entrar.',
          },
          it: {
            objection: 'Il team resisterà al cambio di abitudini.',
            model_answer:
              'Migri per team pilota: un team campione dimostra il valore in 2 settimane e gli altri chiedono di entrare.',
          },
        },
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
