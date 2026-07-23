import type { CallType, FrameworkId } from '@/types';

export interface CriterionDef {
  key: string;
  /** Peso em % — os pesos de um framework somam 100. */
  weight: number;
  labels: { pt: string; it: string; en: string };
  description: { pt: string; it: string; en: string };
}

export interface FrameworkDef {
  id: FrameworkId;
  name: string;
  criteria: CriterionDef[];
}

export const FRAMEWORKS: Record<FrameworkId, FrameworkDef> = {
  basic: {
    id: 'basic',
    name: 'Fundamentos',
    criteria: [
      {
        key: 'abertura',
        weight: 15,
        labels: { pt: 'Abertura', it: 'Apertura', en: 'Opening' },
        description: {
          pt: 'Pattern interrupt, permissão, motivo da ligação em menos de 20s',
          it: 'Pattern interrupt, permesso, motivo della chiamata in meno di 20s',
          en: 'Pattern interrupt, permission, reason for the call in under 20s',
        },
      },
      {
        key: 'descoberta',
        weight: 25,
        labels: { pt: 'Descoberta', it: 'Discovery', en: 'Discovery' },
        description: {
          pt: 'Perguntas abertas, qualificação, cavou a dor?',
          it: 'Domande aperte, qualificazione, ha scavato nel dolore?',
          en: 'Open questions, qualification, did you dig into the pain?',
        },
      },
      {
        key: 'escuta_ativa',
        weight: 15,
        labels: { pt: 'Escuta ativa', it: 'Ascolto attivo', en: 'Active listening' },
        description: {
          pt: 'Respondeu ao que a persona disse ou seguiu script cego?',
          it: 'Ha risposto a ciò che la persona ha detto o ha seguito un copione?',
          en: 'Did you respond to what the persona said or follow a blind script?',
        },
      },
      {
        key: 'tratamento_objecoes',
        weight: 20,
        labels: { pt: 'Tratamento de objeções', it: 'Gestione obiezioni', en: 'Objection handling' },
        description: {
          pt: 'Acknowledge → explore → respond (não rebater na hora)',
          it: 'Acknowledge → explore → respond (non ribattere subito)',
          en: 'Acknowledge → explore → respond (don’t argue back instantly)',
        },
      },
      {
        key: 'clareza_valor',
        weight: 10,
        labels: { pt: 'Clareza de valor', it: 'Chiarezza del valore', en: 'Value clarity' },
        description: {
          pt: 'Conectou feature → dor específica da persona',
          it: 'Ha collegato feature → dolore specifico della persona',
          en: 'Connected feature → the persona’s specific pain',
        },
      },
      {
        key: 'proximo_passo',
        weight: 15,
        labels: { pt: 'Próximo passo', it: 'Prossimo passo', en: 'Next step' },
        description: {
          pt: 'Pediu o meeting? Data/hora concreta?',
          it: 'Ha chiesto il meeting? Data/ora concreta?',
          en: 'Did you ask for the meeting? Concrete date/time?',
        },
      },
    ],
  },
  SPICED: {
    id: 'SPICED',
    name: 'SPICED',
    criteria: [
      {
        key: 'situation',
        weight: 15,
        labels: { pt: 'Situação', it: 'Situazione', en: 'Situation' },
        description: {
          pt: 'Entendeu o contexto atual do prospect (stack, processo, time)?',
          it: 'Ha capito il contesto attuale del prospect?',
          en: 'Understood the prospect’s current context (stack, process, team)?',
        },
      },
      {
        key: 'pain',
        weight: 25,
        labels: { pt: 'Dor', it: 'Dolore', en: 'Pain' },
        description: {
          pt: 'Identificou e aprofundou a dor real, não a superficial',
          it: 'Ha identificato e approfondito il dolore reale',
          en: 'Identified and dug into the real pain, not the surface one',
        },
      },
      {
        key: 'impact',
        weight: 25,
        labels: { pt: 'Impacto', it: 'Impatto', en: 'Impact' },
        description: {
          pt: 'Quantificou o custo da dor (dinheiro, tempo, risco)?',
          it: 'Ha quantificato il costo del dolore?',
          en: 'Quantified the cost of the pain (money, time, risk)?',
        },
      },
      {
        key: 'critical_event',
        weight: 15,
        labels: { pt: 'Evento crítico', it: 'Evento critico', en: 'Critical event' },
        description: {
          pt: 'Descobriu deadline ou evento que força decisão?',
          it: 'Ha scoperto una deadline che forza la decisione?',
          en: 'Uncovered a deadline or event that forces a decision?',
        },
      },
      {
        key: 'decision',
        weight: 20,
        labels: { pt: 'Decisão', it: 'Decisione', en: 'Decision' },
        description: {
          pt: 'Mapeou processo e critérios de decisão + próximo passo concreto',
          it: 'Ha mappato processo e criteri di decisione + prossimo passo',
          en: 'Mapped decision process and criteria + concrete next step',
        },
      },
    ],
  },
  MEDDIC: {
    id: 'MEDDIC',
    name: 'MEDDIC',
    criteria: [
      {
        key: 'metrics',
        weight: 20,
        labels: { pt: 'Métricas', it: 'Metriche', en: 'Metrics' },
        description: {
          pt: 'Quantificou o valor econômico da solução?',
          it: 'Ha quantificato il valore economico della soluzione?',
          en: 'Quantified the economic value of the solution?',
        },
      },
      {
        key: 'economic_buyer',
        weight: 15,
        labels: { pt: 'Comprador econômico', it: 'Economic buyer', en: 'Economic buyer' },
        description: {
          pt: 'Identificou quem assina o cheque?',
          it: 'Ha identificato chi firma l’assegno?',
          en: 'Identified who signs the check?',
        },
      },
      {
        key: 'decision_criteria',
        weight: 15,
        labels: { pt: 'Critérios de decisão', it: 'Criteri di decisione', en: 'Decision criteria' },
        description: {
          pt: 'Descobriu como a solução será avaliada?',
          it: 'Ha scoperto come sarà valutata la soluzione?',
          en: 'Uncovered how the solution will be evaluated?',
        },
      },
      {
        key: 'decision_process',
        weight: 15,
        labels: { pt: 'Processo de decisão', it: 'Processo di decisione', en: 'Decision process' },
        description: {
          pt: 'Mapeou etapas, aprovações e timeline da compra?',
          it: 'Ha mappato fasi, approvazioni e timeline?',
          en: 'Mapped steps, approvals and buying timeline?',
        },
      },
      {
        key: 'identify_pain',
        weight: 20,
        labels: { pt: 'Dor identificada', it: 'Dolore identificato', en: 'Identified pain' },
        description: {
          pt: 'Cavou a dor de negócio com impacto claro?',
          it: 'Ha scavato nel dolore di business con impatto chiaro?',
          en: 'Dug into business pain with clear impact?',
        },
      },
      {
        key: 'champion',
        weight: 15,
        labels: { pt: 'Champion', it: 'Champion', en: 'Champion' },
        description: {
          pt: 'Testou se a persona vira aliada interna da venda?',
          it: 'Ha testato se la persona diventa alleata interna?',
          en: 'Tested whether the persona becomes an internal ally?',
        },
      },
    ],
  },
};

export function getFramework(id: FrameworkId): FrameworkDef {
  return FRAMEWORKS[id] ?? FRAMEWORKS.basic;
}

/**
 * Rubrica recomendada por tipo de call — uma cold call e uma negociação são
 * jogos diferentes e não devem ser avaliadas pela mesma régua.
 */
export function frameworkForCallType(callType: CallType): FrameworkId {
  switch (callType) {
    case 'discovery':
      return 'SPICED';
    case 'negotiation':
      return 'MEDDIC';
    case 'cold_call':
    case 'demo':
    default:
      return 'basic';
  }
}

/** Nota geral 0-100 ponderada pelos pesos do framework. */
export function weightedOverall(
  frameworkId: FrameworkId,
  scores: Record<string, { score: number }>,
): number {
  const fw = getFramework(frameworkId);
  let total = 0;
  let weightUsed = 0;
  for (const c of fw.criteria) {
    const s = scores[c.key];
    if (s && Number.isFinite(s.score)) {
      total += (s.score / 10) * c.weight;
      weightUsed += c.weight;
    }
  }
  if (weightUsed === 0) return 0;
  return Math.round((total / weightUsed) * 100);
}
