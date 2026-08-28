import type { Persona } from '@/types';

/**
 * Convenção de idioma (importante ao editar):
 *  - Campos EXIBIDOS na interface (`name`, `role`, `company_profile`) ficam em
 *    inglês, como o resto da UI.
 *  - Campos FALADOS pelo prospect durante a call (`pain_points`,
 *    `hidden_objections`) ficam no idioma da call dessa persona — eles viram
 *    literalmente as falas no modo demo e alimentam o prompt no modo Claude.
 *    Cada persona é usada por cenários de um único idioma.
 * Misturar isso faz o prospect falar duas línguas na mesma frase.
 */
export const SEED_PERSONAS: Persona[] = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    name: 'Marta',
    role: 'CFO',
    company_profile:
      'Logistics scale-up with 180 employees and tight margins. Just cut 3 SaaS tools nobody was using.',
    personality: { skepticism: 5, patience: 2, talkativeness: 2 },
    // Falado (pt-BR)
    pain_points: [
      'A previsão de receita do comercial erra por mais de 30% todo trimestre',
      'Não sabe dizer quanto custa adquirir um cliente porque os dados estão espalhados',
      'O board pressiona por eficiência: cada gasto novo precisa de business case',
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
    role: 'Head of Sales',
    company_profile:
      'B2B SaaS company with 45 employees and a team of 8 reps. Grew fast and the sales process became a patchwork.',
    personality: { skepticism: 3, patience: 3, talkativeness: 4 },
    // Falado (pt-BR)
    pain_points: [
      'Os reps esquecem o follow-up e os deals esfriam sem ninguém perceber',
      'O onboarding de um vendedor novo leva 3 meses porque nada está documentado',
      'O relatório para a diretoria é montado à mão todo fim de mês',
    ],
    hidden_objections: [
      'A gente já usa HubSpot, migrar seria um caos.',
      'Meu time mal preenche o CRM atual, outro sistema não resolve.',
      'Estamos em fim de trimestre agora — me procura daqui a dois meses.',
    ],
    buying_stage: 'aware',
  },
  {
    id: '00000000-0000-4000-8000-000000000203',
    name: 'Giulia',
    role: 'Operations Manager',
    company_profile:
      'Fashion e-commerce in Milan with 60 employees. Reports to the COO. Curious about tech, but has no budget of her own.',
    personality: { skepticism: 2, patience: 4, talkativeness: 4 },
    // Falado (it-IT)
    pain_points: [
      'Il servizio clienti va in tilt nei picchi di vendita (Black Friday, saldi) e il CSAT crolla',
      'Metà dei ticket sono "dov’è il mio ordine?" — puro lavoro ripetitivo',
      'Le informazioni sui clienti sono sparse tra email, WhatsApp e fogli di calcolo',
    ],
    hidden_objections: [
      'L’idea mi piace, ma è il mio COO che decide.',
      'Non ho un budget approvato per quest’anno.',
      'Mi serve qualcosa che il mio piccolo team riesca a gestire da solo.',
    ],
    buying_stage: 'aware',
  },
  {
    id: '00000000-0000-4000-8000-000000000204',
    name: 'Ricardo',
    role: 'CEO',
    company_profile:
      'Family-owned industrial SMB with 90 employees. Packed schedule, decides fast and hates fluff. Answered the phone by accident.',
    personality: { skepticism: 4, patience: 1, talkativeness: 2 },
    // Falado (pt-PT)
    pain_points: [
      'Perde negócios para concorrentes mais rápidos a orçamentar',
      'Depende de dois vendedores seniores que "têm tudo na cabeça"',
      'Quer profissionalizar a empresa para uma futura sucessão',
    ],
    hidden_objections: [
      'Tem 30 segundos. Porque é que me ligou?',
      'Envie-me um e-mail que eu vejo depois.',
      'Isso é assunto para o meu director comercial, não para mim.',
    ],
    buying_stage: 'cold',
  },
  {
    id: '00000000-0000-4000-8000-000000000205',
    name: 'Ana',
    role: 'IT Director',
    company_profile:
      'Retail group with 400 employees and a legacy stack (old ERP + on-premise AD). Already got burned by a software project that blew its deadline.',
    personality: { skepticism: 4, patience: 3, talkativeness: 3 },
    // Falado (en-US)
    pain_points: [
      'Business units buy SaaS on the side and create shadow IT',
      'Fragile integrations break with every ERP update',
      'Leadership pressure for "digital transformation" with no new headcount',
    ],
    hidden_objections: [
      'How does this integrate with our legacy ERP? Technical detail, please.',
      'Where does the data live? LGPD/GDPR is non-negotiable.',
      'Who maintains it? My team is already at its limit.',
      'I have seen this promise before and the project was 8 months late.',
    ],
    buying_stage: 'evaluating',
  },
  {
    id: '00000000-0000-4000-8000-000000000206',
    name: 'Mr. Bianchi',
    role: 'Owner',
    company_profile:
      'Family food distributor in Turin, 35 employees, 40 years of history. Does business on a handshake and distrusts "this internet stuff".',
    personality: { skepticism: 5, patience: 2, talkativeness: 3 },
    // Falado (it-IT)
    pain_points: [
      'Suo figlio insiste che l’azienda debba modernizzarsi prima che i clienti se ne vadano',
      'Gli ordini presi al telefono causano un errore di consegna ogni settimana',
      'Un nuovo concorrente con un sistema online sta rubando i clienti piccoli',
    ],
    hidden_objections: [
      'Funziona così da 40 anni, perché cambiare?',
      'Il computer dà più problemi di quanti ne risolva.',
      'Costa caro e la mia azienda ha margini bassi.',
      'Non mi fido di un venditore che chiama senza che io l’abbia chiesto.',
    ],
    buying_stage: 'cold',
  },
];
