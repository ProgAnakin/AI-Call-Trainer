import type { Product } from '@/types';

/**
 * IDs fixos (mesmos UUIDs do seed SQL em supabase/migrations) para que o modo
 * local e o modo Supabase compartilhem as mesmas referências.
 */
export const SEED_PRODUCTS: Product[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    name: 'Sales Cloud',
    vendor: 'Salesforce',
    one_liner:
      'CRM nº 1 do mercado: pipeline, previsão de vendas e automação num só lugar, com IA embutida.',
    key_features: [
      {
        feature: 'Gestão de pipeline unificada',
        benefit: 'Todos os deals visíveis num só funil — nada se perde em planilhas.',
      },
      {
        feature: 'Forecasting com IA (Einstein)',
        benefit: 'Previsão de fechamento baseada em dados reais, não em achismo do gestor.',
      },
      {
        feature: 'Automação de tarefas e cadências',
        benefit: 'Rep gasta tempo vendendo, não atualizando campos e mandando follow-up manual.',
      },
      {
        feature: 'Relatórios e dashboards em tempo real',
        benefit: 'Gestor enxerga gargalo do funil na hora, sem esperar fechamento do mês.',
      },
      {
        feature: 'AppExchange (5.000+ integrações)',
        benefit: 'Conecta com o stack que a empresa já usa, do ERP ao WhatsApp.',
      },
    ],
    pricing_notes:
      'Por usuário/mês: Starter ~€25, Pro ~€100, Enterprise ~€165. Contrato anual. Implementação é custo à parte.',
    common_objections: [
      {
        objection: 'É caro demais para o nosso tamanho.',
        model_answer:
          'Comparado a quê? Um deal perdido por follow-up esquecido custa quanto? O Starter custa menos que um almoço por dia por rep.',
      },
      {
        objection: 'Já usamos planilhas e funciona.',
        model_answer:
          'Funciona até o dia em que o vendedor sai e leva o histórico junto. Quantos deals estão hoje na cabeça de uma pessoa só?',
      },
      {
        objection: 'Implementação é longa e complexa.',
        model_answer:
          'O Starter roda em dias, não meses. A complexidade vem quando a operação cresce — e aí é sinal de que valeu.',
      },
      {
        objection: 'Meu time não vai adotar mais uma ferramenta.',
        model_answer:
          'Adoção é problema de processo, não de ferramenta. Por isso o rollout começa com o fluxo que o time já faz — só que automático.',
      },
      {
        objection: 'Já temos HubSpot / outro CRM.',
        model_answer:
          'Ótimo — o que está faltando nele hoje? Normalmente ouvimos previsão de vendas e customização. É exatamente onde o Sales Cloud é mais forte.',
      },
    ],
    competitors: [
      {
        name: 'HubSpot',
        key_difference:
          'HubSpot é mais simples e barato no início; Sales Cloud escala melhor em customização, forecasting e ecossistema enterprise.',
      },
      {
        name: 'Microsoft Dynamics 365',
        key_difference:
          'Dynamics agrada quem já vive no ecossistema Microsoft; Salesforce tem UX mais madura para vendas e o maior marketplace de apps.',
      },
      {
        name: 'Pipedrive',
        key_difference:
          'Pipedrive é ótimo para times pequenos focados em pipeline; não acompanha em automação avançada, IA e governança.',
      },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    name: 'Agentforce',
    vendor: 'Salesforce',
    one_liner:
      'Agentes de IA autônomos que atendem, qualificam e resolvem — integrados aos dados do seu CRM, 24/7.',
    key_features: [
      {
        feature: 'Agentes autônomos com guardrails',
        benefit: 'Resolve casos de ponta a ponta sem humano, mas dentro de limites que você define.',
      },
      {
        feature: 'Treinado nos dados do seu Salesforce',
        benefit: 'Respostas com contexto real do cliente, não genéricas de chatbot.',
      },
      {
        feature: 'Handoff inteligente para humanos',
        benefit: 'Quando o caso é complexo, passa para o time com todo o histórico resumido.',
      },
      {
        feature: 'Low-code builder (Agent Builder)',
        benefit: 'Ops cria e ajusta agentes sem depender de engenharia.',
      },
      {
        feature: 'Atende em múltiplos canais e idiomas',
        benefit: 'Um agente cobre site, WhatsApp e e-mail em PT/EN/IT sem triplicar o time.',
      },
    ],
    pricing_notes:
      'Modelo por conversa (~$2/conversa no lançamento) ou pacotes de crédito. Requer Salesforce como base de dados.',
    common_objections: [
      {
        objection: 'IA vai falar besteira para o meu cliente.',
        model_answer:
          'Por isso existem guardrails e escopo fechado: o agente só age sobre tópicos e ações que você aprovou, com auditoria completa.',
      },
      {
        objection: 'Já testamos chatbot e foi péssimo.',
        model_answer:
          'Chatbot de árvore de decisão ≠ agente com contexto do CRM. A diferença é resolver o caso, não redirecionar para FAQ.',
      },
      {
        objection: 'Pagar por conversa fica caro em escala.',
        model_answer:
          'Compare com o custo por atendimento humano (€3-8). O agente resolve os repetitivos e o time foca nos casos de valor.',
      },
      {
        objection: 'Meu time vai achar que será substituído.',
        model_answer:
          'Os primeiros casos são os que ninguém quer: madrugada, fim de semana, perguntas repetidas. O time sobe de nível, não sai.',
      },
      {
        objection: 'Não temos dados organizados para isso.',
        model_answer:
          'É o caso mais comum. O rollout começa com um escopo pequeno e bem documentado — e expõe exatamente onde os dados precisam melhorar.',
      },
    ],
    competitors: [
      {
        name: 'Microsoft Copilot Studio',
        key_difference:
          'Forte no ecossistema Office; Agentforce ganha quando o dado do cliente já vive no Salesforce.',
      },
      {
        name: 'Intercom Fin',
        key_difference:
          'Fin é excelente para suporte SaaS; Agentforce cobre vendas + serviço + marketing sobre o mesmo CRM.',
      },
      {
        name: 'Chatbots custom (OpenAI/Claude direto)',
        key_difference:
          'Build próprio dá flexibilidade, mas você mantém infra, segurança e integração. Agentforce vem com isso pronto e auditável.',
      },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    name: 'Service Cloud',
    vendor: 'Salesforce',
    one_liner:
      'Plataforma de atendimento omnichannel: todos os canais, o histórico completo do cliente e IA num só console.',
    key_features: [
      {
        feature: 'Console unificado omnichannel',
        benefit: 'Agente vê e-mail, chat, telefone e WhatsApp do cliente numa tela só.',
      },
      {
        feature: 'Roteamento inteligente de casos',
        benefit: 'Caso certo para o agente certo — SLA para de estourar por distribuição manual.',
      },
      {
        feature: 'Base de conhecimento integrada',
        benefit: 'Respostas consistentes e self-service que reduz volume de tickets.',
      },
      {
        feature: 'Einstein para atendimento',
        benefit: 'Resumo automático de caso, sugestão de resposta e classificação sem digitação.',
      },
      {
        feature: 'Relatórios de CSAT/SLA em tempo real',
        benefit: 'Gestor enxerga fila, tempo de resposta e satisfação sem montar planilha.',
      },
    ],
    pricing_notes:
      'Por usuário/mês: Starter ~€25 até Enterprise ~€165. Add-ons de canal (voz, WhatsApp) cobrados à parte.',
    common_objections: [
      {
        objection: 'Zendesk faz o mesmo e é mais barato.',
        model_answer:
          'Para ticket simples, sim. A diferença aparece quando atendimento precisa do contexto de vendas: no Service Cloud o histórico é o mesmo CRM.',
      },
      {
        objection: 'Nosso volume não justifica.',
        model_answer:
          'Qual o custo de um cliente que cancela por atendimento ruim? O ROI raramente vem do volume, vem da retenção.',
      },
      {
        objection: 'Migrar os tickets antigos é inviável.',
        model_answer:
          'Migração é faseada: canais novos entram primeiro, o legado fica em leitura. Ninguém perde histórico.',
      },
      {
        objection: 'Meu time mal usa o sistema atual.',
        model_answer:
          'Sinal clássico de ferramenta que atrapalha em vez de ajudar. Adoção melhora quando o sistema tira trabalho em vez de criar.',
      },
      {
        objection: 'IA no atendimento vai irritar o cliente.',
        model_answer:
          'IA mal implementada, sim. Aqui ela resume, sugere e roteia — o cliente continua falando com gente, só que gente mais rápida.',
      },
    ],
    competitors: [
      {
        name: 'Zendesk',
        key_difference:
          'Zendesk é mais rápido de implantar; Service Cloud ganha em visão 360º do cliente e integração com vendas.',
      },
      {
        name: 'Freshdesk',
        key_difference:
          'Freshdesk compete por preço; Service Cloud entrega governança e escala enterprise.',
      },
      {
        name: 'Intercom',
        key_difference:
          'Intercom brilha em chat/produto SaaS; Service Cloud cobre operações de serviço completas incluindo voz e field service.',
      },
    ],
  },
  {
    id: '00000000-0000-4000-8000-000000000104',
    name: 'Slack',
    vendor: 'Salesforce',
    one_liner:
      'O QG digital da empresa: comunicação por canais, integrações com todo o stack e automação sem código.',
    key_features: [
      {
        feature: 'Canais organizados por projeto/tema',
        benefit: 'Fim do e-mail interno: contexto fica público, pesquisável e entra quem precisa.',
      },
      {
        feature: 'Huddles (áudio/vídeo instantâneo)',
        benefit: 'Resolve em 5 minutos o que viraria uma reunião de 30 na agenda.',
      },
      {
        feature: 'Workflow Builder sem código',
        benefit: 'Onboarding, aprovações e avisos automatizados sem depender de TI.',
      },
      {
        feature: '2.600+ integrações (Google, Jira, Salesforce...)',
        benefit: 'Notificações e ações dos outros sistemas acontecem onde o time já está.',
      },
      {
        feature: 'Slack Connect com parceiros externos',
        benefit: 'Cliente e fornecedor no mesmo canal seguro — sem thread de e-mail infinita.',
      },
    ],
    pricing_notes:
      'Free tier limitado (90 dias de histórico). Pro ~€7,25/usuário/mês, Business+ ~€12,50. Enterprise sob consulta.',
    common_objections: [
      {
        objection: 'Já temos Microsoft Teams incluso no pacote.',
        model_answer:
          '“Incluso” não é “usado”. Pergunte ao time onde a conversa de verdade acontece. Slack ganha em UX, busca e integrações.',
      },
      {
        objection: 'Slack vira distração e ruído.',
        model_answer:
          'Ruído é cultura, não ferramenta. Canais bem desenhados + notificações configuradas geram menos interrupção que e-mail.',
      },
      {
        objection: 'É caro para ferramenta de chat.',
        model_answer:
          'Chat é 20% do valor. O resto é busca do conhecimento da empresa, automação e integração — quanto custa a informação que se perde hoje?',
      },
      {
        objection: 'Segurança/compliance não aprova.',
        model_answer:
          'Slack tem certificações enterprise (SOC 2, ISO 27001, HIPAA no plano certo) e controles de retenção/DLP. O que o compliance exige?',
      },
      {
        objection: 'O time vai resistir a mudar de hábito.',
        model_answer:
          'Migração por equipe-piloto: um time campeão prova o valor em 2 semanas e o resto pede para entrar.',
      },
    ],
    competitors: [
      {
        name: 'Microsoft Teams',
        key_difference:
          'Teams vem “grátis” no Microsoft 365; Slack ganha em experiência, velocidade, busca e ecossistema de apps.',
      },
      {
        name: 'Google Chat',
        key_difference:
          'Google Chat é básico e serve quem vive no Workspace; Slack é uma plataforma de trabalho, não só chat.',
      },
      {
        name: 'Discord',
        key_difference:
          'Discord domina comunidades; não tem os controles corporativos, compliance e integrações B2B do Slack.',
      },
    ],
  },
];
