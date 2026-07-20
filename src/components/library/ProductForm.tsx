import { useState } from 'react';
import type { Product } from '@/types';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { useT } from '@/i18n';

function parsePipeLines(text: string): [string, string][] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, ...rest] = l.split('|');
      return [a.trim(), rest.join('|').trim()] as [string, string];
    });
}

function toPipeLines(pairs: [string, string][]): string {
  return pairs.map(([a, b]) => `${a} | ${b}`).join('\n');
}

interface Props {
  initial?: Product;
  onSave: (p: Product) => void;
  onCancel: () => void;
}

export function ProductForm({ initial, onSave, onCancel }: Props) {
  const { t } = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [vendor, setVendor] = useState(initial?.vendor ?? '');
  const [oneLiner, setOneLiner] = useState(initial?.one_liner ?? '');
  const [pricing, setPricing] = useState(initial?.pricing_notes ?? '');
  const [features, setFeatures] = useState(
    toPipeLines((initial?.key_features ?? []).map((f) => [f.feature, f.benefit])),
  );
  const [objections, setObjections] = useState(
    toPipeLines((initial?.common_objections ?? []).map((o) => [o.objection, o.model_answer])),
  );
  const [competitors, setCompetitors] = useState(
    toPipeLines((initial?.competitors ?? []).map((c) => [c.name, c.key_difference])),
  );

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      vendor: vendor.trim(),
      one_liner: oneLiner.trim(),
      pricing_notes: pricing.trim(),
      key_features: parsePipeLines(features).map(([feature, benefit]) => ({ feature, benefit })),
      common_objections: parsePipeLines(objections).map(([objection, model_answer]) => ({
        objection,
        model_answer,
      })),
      competitors: parsePipeLines(competitors).map(([n, key_difference]) => ({
        name: n,
        key_difference,
      })),
      custom: true,
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('form.name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('form.vendor')}>
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </Field>
      </div>
      <Field label={t('form.oneLiner')}>
        <Input value={oneLiner} onChange={(e) => setOneLiner(e.target.value)} />
      </Field>
      <Field label={t('form.pricingNotes')}>
        <Input value={pricing} onChange={(e) => setPricing(e.target.value)} />
      </Field>
      <Field label={t('form.keyFeatures')}>
        <Textarea rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} />
      </Field>
      <Field label={t('form.objections')}>
        <Textarea rows={4} value={objections} onChange={(e) => setObjections(e.target.value)} />
      </Field>
      <Field label={t('form.competitors')}>
        <Textarea rows={3} value={competitors} onChange={(e) => setCompetitors(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={!name.trim()}>
          {t('library.save')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('library.cancel')}
        </Button>
      </div>
    </div>
  );
}
