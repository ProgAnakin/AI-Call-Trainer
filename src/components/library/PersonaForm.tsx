import { useState } from 'react';
import type { BuyingStage, Persona } from '@/types';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { useT } from '@/i18n';

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

interface Props {
  initial?: Persona;
  onSave: (p: Persona) => void;
  onCancel: () => void;
}

export function PersonaForm({ initial, onSave, onCancel }: Props) {
  const { t } = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [profile, setProfile] = useState(initial?.company_profile ?? '');
  const [skepticism, setSkepticism] = useState(initial?.personality.skepticism ?? 3);
  const [patience, setPatience] = useState(initial?.personality.patience ?? 3);
  const [talkativeness, setTalkativeness] = useState(initial?.personality.talkativeness ?? 3);
  const [pains, setPains] = useState((initial?.pain_points ?? []).join('\n'));
  const [objections, setObjections] = useState((initial?.hidden_objections ?? []).join('\n'));
  const [stage, setStage] = useState<BuyingStage>(initial?.buying_stage ?? 'cold');

  const submit = () => {
    if (!name.trim() || !role.trim()) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      role: role.trim(),
      company_profile: profile.trim(),
      personality: { skepticism, patience, talkativeness },
      pain_points: parseLines(pains),
      hidden_objections: parseLines(objections),
      buying_stage: stage,
      custom: true,
    });
  };

  const sliderField = (
    label: string,
    value: number,
    setter: (n: number) => void,
  ) => (
    <Field label={`${label}: ${value}/5`}>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => setter(Number(e.target.value))}
        className="w-full accent-indigo-500"
      />
    </Field>
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('form.name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('form.role')}>
          <Input value={role} onChange={(e) => setRole(e.target.value)} />
        </Field>
      </div>
      <Field label={t('form.companyProfile')}>
        <Textarea rows={2} value={profile} onChange={(e) => setProfile(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        {sliderField(t('form.skepticism'), skepticism, setSkepticism)}
        {sliderField(t('form.patience'), patience, setPatience)}
        {sliderField(t('form.talkativeness'), talkativeness, setTalkativeness)}
      </div>
      <Field label={t('form.painPoints')}>
        <Textarea rows={3} value={pains} onChange={(e) => setPains(e.target.value)} />
      </Field>
      <Field label={t('form.hiddenObjections')}>
        <Textarea rows={3} value={objections} onChange={(e) => setObjections(e.target.value)} />
      </Field>
      <Field label={t('form.buyingStage')}>
        <Select value={stage} onChange={(e) => setStage(e.target.value as BuyingStage)}>
          <option value="cold">cold</option>
          <option value="aware">aware</option>
          <option value="evaluating">evaluating</option>
        </Select>
      </Field>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={!name.trim() || !role.trim()}>
          {t('library.save')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('library.cancel')}
        </Button>
      </div>
    </div>
  );
}
