import { useState } from 'react';
import type { CallType, Language, Scenario } from '@/types';
import { listPersonas, listProducts } from '@/lib/storage';
import { TIME_LIMITS } from '@/data/seed/scenarios';
import { Button, Field, Input, Select } from '@/components/ui';
import { useT } from '@/i18n';

interface Props {
  initial?: Scenario;
  onSave: (s: Scenario) => void;
  onCancel: () => void;
}

export function ScenarioBuilder({ initial, onSave, onCancel }: Props) {
  const { t } = useT();
  const personas = listPersonas();
  const products = listProducts();

  const [personaId, setPersonaId] = useState(initial?.persona_id ?? personas[0]?.id ?? '');
  const [productId, setProductId] = useState(initial?.product_id ?? products[0]?.id ?? '');
  const [callType, setCallType] = useState<CallType>(initial?.call_type ?? 'cold_call');
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 3);
  const [language, setLanguage] = useState<Language>(initial?.language ?? 'pt-BR');
  const [timeLimit, setTimeLimit] = useState(initial?.time_limit_seconds ?? TIME_LIMITS.cold_call);
  const [criteria, setCriteria] = useState(initial?.success_criteria ?? '');

  const submit = () => {
    if (!personaId || !productId || !criteria.trim()) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      persona_id: personaId,
      product_id: productId,
      call_type: callType,
      difficulty,
      language,
      time_limit_seconds: timeLimit,
      success_criteria: criteria.trim(),
      custom: true,
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('form.persona')}>
          <Select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.role}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('form.product')}>
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('form.callType')}>
          <Select
            value={callType}
            onChange={(e) => {
              const ct = e.target.value as CallType;
              setCallType(ct);
              setTimeLimit(TIME_LIMITS[ct]);
            }}
          >
            <option value="cold_call">{t('callType.cold_call')}</option>
            <option value="discovery">{t('callType.discovery')}</option>
            <option value="demo">{t('callType.demo')}</option>
            <option value="negotiation">{t('callType.negotiation')}</option>
          </Select>
        </Field>
        <Field label={`${t('form.difficulty')}: ${difficulty}/5`}>
          <input
            type="range"
            min={1}
            max={5}
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
            className="mt-2 w-full accent-indigo-500"
          />
        </Field>
        <Field label={t('form.language')}>
          <Select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            <option value="pt-BR">🇧🇷 pt-BR</option>
            <option value="pt-PT">🇵🇹 pt-PT</option>
            <option value="it-IT">🇮🇹 it-IT</option>
            <option value="en-US">🇺🇸 en-US</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('form.timeLimit')}>
          <Input
            type="number"
            min={60}
            step={30}
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
          />
        </Field>
        <Field label={t('form.successCriteria')}>
          <Input value={criteria} onChange={(e) => setCriteria(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={!personaId || !productId || !criteria.trim()}>
          {t('library.save')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('library.cancel')}
        </Button>
      </div>
    </div>
  );
}
