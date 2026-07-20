import type { Persona } from '@/types';

export const SEED_PERSONAS: Persona[] = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    name: 'Marta',
    role: 'CFO',
    company_profile:
      'Scale-up de logística com 180 funcionários e margens apertadas. Acabou de cortar 3 ferramentas SaaS que ninguém usava.',
    personality: { skepticism: 5, patience: 2, talkativeness: 2 },
    pain_points: [
      'Previsão de receita do comercial erra por mais de 30% todo trimestre',
      'Não sabe dizer quanto custa adquirir um cliente porque os dados estão espalhados',
      'Board pressiona por eficiência: cada gasto novo precisa de business case',
    ],
    hidden_objections: [
      'Quanto custa? Me diga o número agora.',
      'Qual o ROI comprovado? Quero caso real, não promessa.',
      'Quem vai implementar isso? Não tenho gente sobrando.',
      'Já cortamos SaaS este ano — por que eu adicionaria outro?',
    ],
    buying_stage: 'cold',
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    name: 'Paulo',
    role: 'Head de Vendas',
    company_profile:
      'Empresa SaaS B2B com 45 funcionários, time de 8 vendedores. Cresceu rápido e o processo comercial virou colcha de retalhos.',
    personality: { skepticism: 3, patience: 3, talkativeness: 4 },
    pain_points: [
      'Reps esquecem follow-up e deals esfriam sem ninguém perceber',
      'Onboarding de vendedor novo leva 3 meses porque nada está documentado',
      'Relatório para a diretoria é montado à mão todo fim de mês',
    ],
    hidden_objections: [
      'A gente já usa HubSpot, migrar seria um caos.',
      'Meu time mal preenche o CRM atual, outro sistema não resolve.',
      'Fim de trimestre agora — me procura em dois meses.',
    ],
    buying_stage: 'aware',
  },
  {
    id: '00000000-0000-4000-8000-000000000203',
    name: 'Giulia',
    role: 'Operations Manager',
    company_profile:
      'E-commerce de moda em Milão com 60 funcionários. Reporta ao COO. Curiosa por tecnologia, mas sem orçamento próprio.',
    personality: { skepticism: 2, patience: 4, talkativeness: 4 },
    pain_points: [
      'Atendimento afoga no pico de vendas (Black Friday, saldi) e o CSAT despenca',
      'Metade dos tickets são “onde está meu pedido?” — puro trabalho repetitivo',
      'Informação de cliente espalhada entre e-mail, WhatsApp e planilha',
    ],
    hidden_objections: [
      'Adoro a ideia, mas quem decide é o meu COO.',
      'Não tenho budget aprovado para este ano.',
      'Preciso de algo que meu time pequeno consiga operar sozinho.',
    ],
    buying_stage: 'aware',
  },
  {
    id: '00000000-0000-4000-8000-000000000204',
    name: 'Ricardo',
    role: 'CEO',
    company_profile:
      'PME industrial familiar com 90 funcionários. Agenda lotada, decide rápido e odeia enrolação. Atende o telefone por acaso.',
    personality: { skepticism: 4, patience: 1, talkativeness: 2 },
    pain_points: [
      'Perde negócios para concorrentes mais rápidos no orçamento',
      'Depende de dois vendedores sêniores que “têm tudo na cabeça”',
      'Quer profissionalizar a empresa para uma futura sucessão',
    ],
    hidden_objections: [
      'Você tem 30 segundos. Por que me ligou?',
      'Me manda um e-mail que eu vejo depois.',
      'Isso é assunto para o meu gerente comercial, não para mim.',
    ],
    buying_stage: 'cold',
  },
  {
    id: '00000000-0000-4000-8000-000000000205',
    name: 'Ana',
    role: 'IT Director',
    company_profile:
      'Grupo de varejo com 400 funcionários e stack legado (ERP antigo + AD on-premise). Já se queimou com projeto de software que estourou prazo.',
    personality: { skepticism: 4, patience: 3, talkativeness: 3 },
    pain_points: [
      'Áreas de negócio contratam SaaS por fora e criam shadow IT',
      'Integrações frágeis quebram a cada atualização do ERP',
      'Pressão da diretoria por “transformação digital” sem headcount novo',
    ],
    hidden_objections: [
      'Como isso integra com nosso ERP legado? Detalhe técnico, por favor.',
      'Onde ficam os dados? LGPD/GDPR é inegociável.',
      'Quem dá manutenção? Meu time já está no limite.',
      'Já vi essa promessa antes e o projeto atrasou 8 meses.',
    ],
    buying_stage: 'evaluating',
  },
  {
    id: '00000000-0000-4000-8000-000000000206',
    name: 'Sr. Bianchi',
    role: 'Proprietário',
    company_profile:
      'Distribuidora familiar de alimentos em Turim, 35 funcionários, 40 anos de história. Faz negócio no aperto de mão e desconfia de “essas coisas de internet”.',
    personality: { skepticism: 5, patience: 2, talkativeness: 3 },
    pain_points: [
      'O filho insiste que a empresa precisa se modernizar antes que os clientes migrem',
      'Pedidos anotados por telefone geram erro de entrega toda semana',
      'Concorrente novo com sistema online está roubando clientes pequenos',
    ],
    hidden_objections: [
      'Sempre funcionou assim há 40 anos, por que mudar?',
      'Computador dá mais trabalho do que resolve.',
      'Isso é caro e meu negócio é de margem baixa.',
      'Não confio em vendedor que liga sem eu pedir.',
    ],
    buying_stage: 'cold',
  },
];
