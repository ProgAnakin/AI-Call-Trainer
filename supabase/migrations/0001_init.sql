-- AI Call Trainer — schema inicial (§4 da spec)

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vendor text,
  one_liner text,
  key_features jsonb default '[]',
  pricing_notes text,
  common_objections jsonb default '[]',
  competitors jsonb default '[]'
);

create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  company_profile text,
  personality jsonb default '{"skepticism":3,"patience":3,"talkativeness":3}',
  pain_points jsonb default '[]',
  hidden_objections jsonb default '[]',
  buying_stage text default 'cold' check (buying_stage in ('cold','aware','evaluating'))
);

create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid references personas(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  call_type text not null check (call_type in ('cold_call','discovery','demo','negotiation')),
  difficulty int not null default 3 check (difficulty between 1 and 5),
  language text not null default 'pt-BR' check (language in ('pt-BR','pt-PT','it-IT','en-US')),
  time_limit_seconds int not null default 300,
  success_criteria text
);

create table if not exists sessions (
  id uuid primary key,
  scenario_id uuid not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  mode text not null default 'text' check (mode in ('text','voice')),
  outcome text check (outcome in ('meeting_booked','rejected','abandoned'))
);

create table if not exists turns (
  id uuid primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  speaker text not null check (speaker in ('rep','prospect')),
  content text not null,
  ts timestamptz not null default now()
);

create table if not exists evaluations (
  id uuid primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  overall_score int not null check (overall_score between 0 and 100),
  scores jsonb not null default '{}',
  strengths jsonb not null default '[]',
  improvements jsonb not null default '[]',
  framework text not null default 'basic' check (framework in ('basic','SPICED','MEDDIC')),
  talk_ratio_estimate text,
  created_at timestamptz not null default now()
);

-- Rate limiting das Edge Functions: 1 linha por request de LLM, por device.
create table if not exists usage_events (
  id bigint generated always as identity primary key,
  device_id text not null,
  kind text not null check (kind in ('roleplay_call','evaluate')),
  session_key text,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_device_day on usage_events (device_id, kind, created_at);

-- Ferramenta pessoal single-user: RLS ligada com acesso anon de escrita nas
-- tabelas de sessão (a anon key é pública por definição; o dado é de treino,
-- não sensível). Endureça as policies se abrir para multiusuário.
alter table sessions enable row level security;
alter table turns enable row level security;
alter table evaluations enable row level security;
alter table products enable row level security;
alter table personas enable row level security;
alter table scenarios enable row level security;
alter table usage_events enable row level security;

create policy anon_rw_sessions on sessions for all using (true) with check (true);
create policy anon_rw_turns on turns for all using (true) with check (true);
create policy anon_rw_evaluations on evaluations for all using (true) with check (true);
create policy anon_read_products on products for select using (true);
create policy anon_read_personas on personas for select using (true);
create policy anon_read_scenarios on scenarios for select using (true);
-- usage_events: sem policy para anon — somente a service role (Edge Functions) escreve.

-- ---------------------------------------------------------------------------
-- Seed: mesmos UUIDs fixos usados em src/data/seed/*.ts
-- (conteúdo completo vive no cliente; aqui apenas as chaves para integridade
-- referencial de sessions/scenarios quando o Supabase está configurado)
-- ---------------------------------------------------------------------------

insert into products (id, name, vendor, one_liner) values
  ('00000000-0000-4000-8000-000000000101', 'Sales Cloud', 'Salesforce', 'CRM nº 1 do mercado: pipeline, previsão de vendas e automação num só lugar, com IA embutida.'),
  ('00000000-0000-4000-8000-000000000102', 'Agentforce', 'Salesforce', 'Agentes de IA autônomos que atendem, qualificam e resolvem — integrados aos dados do seu CRM, 24/7.'),
  ('00000000-0000-4000-8000-000000000103', 'Service Cloud', 'Salesforce', 'Plataforma de atendimento omnichannel: todos os canais, o histórico completo do cliente e IA num só console.'),
  ('00000000-0000-4000-8000-000000000104', 'Slack', 'Salesforce', 'O QG digital da empresa: comunicação por canais, integrações com todo o stack e automação sem código.')
on conflict (id) do nothing;

insert into personas (id, name, role, company_profile, buying_stage) values
  ('00000000-0000-4000-8000-000000000201', 'Marta', 'CFO', 'Scale-up de logística com 180 funcionários e margens apertadas.', 'cold'),
  ('00000000-0000-4000-8000-000000000202', 'Paulo', 'Head de Vendas', 'Empresa SaaS B2B com 45 funcionários, time de 8 vendedores.', 'aware'),
  ('00000000-0000-4000-8000-000000000203', 'Giulia', 'Operations Manager', 'E-commerce de moda em Milão com 60 funcionários.', 'aware'),
  ('00000000-0000-4000-8000-000000000204', 'Ricardo', 'CEO', 'PME industrial familiar com 90 funcionários.', 'cold'),
  ('00000000-0000-4000-8000-000000000205', 'Ana', 'IT Director', 'Grupo de varejo com 400 funcionários e stack legado.', 'evaluating'),
  ('00000000-0000-4000-8000-000000000206', 'Sr. Bianchi', 'Proprietário', 'Distribuidora familiar de alimentos em Turim, 35 funcionários.', 'cold')
on conflict (id) do nothing;

insert into scenarios (id, persona_id, product_id, call_type, difficulty, language, time_limit_seconds, success_criteria) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101', 'cold_call', 2, 'pt-BR', 300, 'Agendar uma discovery call de 30 minutos com data e hora concretas.'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 'cold_call', 4, 'pt-BR', 300, 'Sobreviver ao ceticismo e agendar 20 minutos com a CFO.'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000101', 'discovery', 3, 'pt-BR', 600, 'Mapear as 3 dores do processo comercial e sair com próximo passo agendado.'),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000103', 'discovery', 2, 'it-IT', 600, 'Scoprire i dolori del customer service e ottenere un incontro con Giulia + COO.'),
  ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000101', 'cold_call', 5, 'it-IT', 300, 'Guadagnare fiducia e ottenere il permesso di richiamare.'),
  ('00000000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000104', 'cold_call', 4, 'pt-PT', 300, 'Escapar do "manda um e-mail" e agendar 15 minutos.'),
  ('00000000-0000-4000-8000-000000000307', '00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000102', 'discovery', 3, 'en-US', 600, 'Uncover integration concerns and book a technical deep-dive.'),
  ('00000000-0000-4000-8000-000000000308', '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000102', 'demo', 3, 'it-IT', 900, 'Dimostrare il valore per i ticket ripetitivi e definire i prossimi passi con il COO.')
on conflict (id) do nothing;
