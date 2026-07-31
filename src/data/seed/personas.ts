import type { Persona } from '@/types';

export const SEED_PERSONAS: Persona[] = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    name: 'Marta',
    role: 'CFO',
    company_profile:
      'Logistics scale-up with 180 employees and tight margins. Just cut 3 SaaS tools nobody was using.',
    personality: { skepticism: 5, patience: 2, talkativeness: 2 },
    pain_points: [
      'Sales revenue forecast is off by more than 30% every quarter',
      'Cannot say what it costs to acquire a customer because the data is scattered',
      'The board pushes for efficiency: every new expense needs a business case',
    ],
    hidden_objections: [
      'How much does it cost? Give me the number now.',
      'What is the proven ROI? I want a real case, not a promise.',
      'Who is going to implement this? I have no spare people.',
      'We already cut SaaS this year — why would I add another one?',
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
    pain_points: [
      'Reps forget follow-ups and deals go cold without anyone noticing',
      'Onboarding a new rep takes 3 months because nothing is documented',
      'The report for leadership is assembled by hand at every month-end',
    ],
    hidden_objections: [
      'We already use HubSpot, migrating would be chaos.',
      'My team barely fills in the current CRM, another system will not fix that.',
      'It is end of quarter right now — come back to me in two months.',
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
    pain_points: [
      'Support drowns during sales peaks (Black Friday, sales season) and CSAT drops',
      'Half the tickets are "where is my order?" — pure repetitive work',
      'Customer information is scattered across email, WhatsApp and spreadsheets',
    ],
    hidden_objections: [
      'I love the idea, but my COO is the one who decides.',
      'I have no approved budget for this year.',
      'I need something my small team can run on its own.',
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
    pain_points: [
      'Loses deals to competitors who quote faster',
      'Depends on two senior reps who "keep everything in their heads"',
      'Wants to professionalize the company for a future succession',
    ],
    hidden_objections: [
      'You have 30 seconds. Why are you calling me?',
      'Send me an email and I will look at it later.',
      'This is a topic for my sales manager, not for me.',
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
    pain_points: [
      'His son insists the company must modernize before customers move away',
      'Orders taken by phone cause a delivery error every week',
      'A new competitor with an online system is stealing small customers',
    ],
    hidden_objections: [
      'It has always worked this way for 40 years, why change?',
      'A computer is more trouble than it is worth.',
      'This is expensive and my business runs on low margins.',
      'I do not trust a salesperson who calls without me asking.',
    ],
    buying_stage: 'cold',
  },
];
