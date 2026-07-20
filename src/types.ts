export type Language = 'pt-BR' | 'pt-PT' | 'it-IT' | 'en-US';
export type UiLanguage = 'pt' | 'it' | 'en';
export type CallType = 'cold_call' | 'discovery' | 'demo' | 'negotiation';
export type BuyingStage = 'cold' | 'aware' | 'evaluating';
export type SessionMode = 'text' | 'voice';
export type SessionOutcome = 'meeting_booked' | 'rejected' | 'abandoned';
export type FrameworkId = 'basic' | 'SPICED' | 'MEDDIC';
export type Speaker = 'rep' | 'prospect';

export interface KeyFeature {
  feature: string;
  benefit: string;
}

export interface ModelObjection {
  objection: string;
  model_answer: string;
}

export interface Competitor {
  name: string;
  key_difference: string;
}

export interface Product {
  id: string;
  name: string;
  vendor: string;
  one_liner: string;
  key_features: KeyFeature[];
  pricing_notes: string;
  common_objections: ModelObjection[];
  competitors: Competitor[];
  custom?: boolean;
}

export interface Personality {
  /** 1 (aberta) a 5 (cética) */
  skepticism: number;
  /** 1 (sem paciência) a 5 (paciente) */
  patience: number;
  /** 1 (monossilábica) a 5 (fala muito) */
  talkativeness: number;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  company_profile: string;
  personality: Personality;
  pain_points: string[];
  hidden_objections: string[];
  buying_stage: BuyingStage;
  custom?: boolean;
}

export interface Scenario {
  id: string;
  persona_id: string;
  product_id: string;
  call_type: CallType;
  /** 1 (fácil) a 5 (brutal) */
  difficulty: number;
  language: Language;
  time_limit_seconds: number;
  success_criteria: string;
  custom?: boolean;
}

export interface Turn {
  id: string;
  session_id: string;
  speaker: Speaker;
  content: string;
  ts: string;
}

export interface Session {
  id: string;
  scenario_id: string;
  started_at: string;
  ended_at: string | null;
  mode: SessionMode;
  outcome: SessionOutcome | null;
}

export interface CriterionScore {
  score: number;
  comment: string;
}

export interface Strength {
  point: string;
  quote: string;
}

export interface Improvement {
  point: string;
  instead_try: string;
}

export interface Evaluation {
  id: string;
  session_id: string;
  overall_score: number;
  scores: Record<string, CriterionScore>;
  strengths: Strength[];
  improvements: Improvement[];
  framework: FrameworkId;
  talk_ratio_estimate?: string;
  created_at: string;
}

export interface ObjectiveMetrics {
  talkRatioRep: number;
  repWords: number;
  prospectWords: number;
  questionsAsked: number;
  durationSeconds: number;
}

export type CallState =
  | 'idle'
  | 'briefing'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'waiting_input'
  | 'ended'
  | 'evaluating'
  | 'scored'
  | 'error';
