import { useReducer, useState } from 'react';
import type { Persona, Product, Scenario } from '@/types';
import {
  deleteCustom,
  listPersonas,
  listProducts,
  listScenarios,
  saveCustomPersona,
  saveCustomProduct,
  saveCustomScenario,
} from '@/lib/storage';
import { ProductForm } from '@/components/library/ProductForm';
import { PersonaForm } from '@/components/library/PersonaForm';
import { ScenarioBuilder } from '@/components/library/ScenarioBuilder';
import { Badge, Button, Card } from '@/components/ui';
import { useT } from '@/i18n';
import { clsx } from 'clsx';

type Tab = 'products' | 'personas' | 'scenarios';

export function Library() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('products');
  const [editing, setEditing] = useState<Product | Persona | Scenario | 'new' | null>(null);
  const [, refresh] = useReducer((n: number) => n + 1, 0);

  const products = listProducts();
  const personas = listPersonas();
  const scenarios = listScenarios();

  const close = () => {
    setEditing(null);
    refresh();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'products', label: t('library.products') },
    { id: 'personas', label: t('library.personas') },
    { id: 'scenarios', label: t('library.scenarios') },
  ];

  const newLabel =
    tab === 'products'
      ? t('library.newProduct')
      : tab === 'personas'
        ? t('library.newPersona')
        : t('library.newScenario');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t('library.title')}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-400">{t('library.subtitle')}</p>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-surface-raised p-1">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => {
                setTab(tb.id);
                setEditing(null);
              }}
              className={clsx(
                'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                tab === tb.id ? 'bg-accent text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setEditing('new')}>+ {newLabel}</Button>
      </div>

      {editing !== null && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-300">{newLabel}</h2>
          {tab === 'products' && (
            <ProductForm
              initial={editing === 'new' ? undefined : (editing as Product)}
              onSave={(p) => {
                saveCustomProduct(p);
                close();
              }}
              onCancel={close}
            />
          )}
          {tab === 'personas' && (
            <PersonaForm
              initial={editing === 'new' ? undefined : (editing as Persona)}
              onSave={(p) => {
                saveCustomPersona(p);
                close();
              }}
              onCancel={close}
            />
          )}
          {tab === 'scenarios' && (
            <ScenarioBuilder
              initial={editing === 'new' ? undefined : (editing as Scenario)}
              onSave={(s) => {
                saveCustomScenario(s);
                close();
              }}
              onCancel={close}
            />
          )}
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {tab === 'products' &&
          products.map((p) => (
            <Card key={p.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <p className="font-semibold">
                  {p.name} <span className="text-xs text-slate-500">· {p.vendor}</span>
                </p>
                <Badge color={p.custom ? 'green' : 'slate'}>
                  {p.custom ? t('library.customTag') : t('library.seedTag')}
                </Badge>
              </div>
              <p className="line-clamp-2 text-xs text-slate-400">{p.one_liner}</p>
              {p.custom && (
                <div className="mt-auto flex gap-2 pt-1">
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(p)}>
                    {t('library.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs text-red-400"
                    onClick={() => {
                      deleteCustom('products', p.id);
                      refresh();
                    }}
                  >
                    {t('library.delete')}
                  </Button>
                </div>
              )}
            </Card>
          ))}

        {tab === 'personas' &&
          personas.map((p) => (
            <Card key={p.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <p className="font-semibold">
                  {p.name} <span className="text-xs text-slate-500">· {p.role}</span>
                </p>
                <Badge color={p.custom ? 'green' : 'slate'}>
                  {p.custom ? t('library.customTag') : t('library.seedTag')}
                </Badge>
              </div>
              <p className="line-clamp-2 text-xs text-slate-400">{p.company_profile}</p>
              {p.custom && (
                <div className="mt-auto flex gap-2 pt-1">
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(p)}>
                    {t('library.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs text-red-400"
                    onClick={() => {
                      deleteCustom('personas', p.id);
                      refresh();
                    }}
                  >
                    {t('library.delete')}
                  </Button>
                </div>
              )}
            </Card>
          ))}

        {tab === 'scenarios' &&
          scenarios.map((s) => {
            const persona = personas.find((p) => p.id === s.persona_id);
            const product = products.find((p) => p.id === s.product_id);
            return (
              <Card key={s.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <p className="font-semibold">
                    {persona?.name ?? '?'} × {product?.name ?? '?'}
                  </p>
                  <Badge color={s.custom ? 'green' : 'slate'}>
                    {s.custom ? t('library.customTag') : t('library.seedTag')}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {t(`callType.${s.call_type}`)} · {s.language} · {s.difficulty}/5
                </p>
                {s.custom && (
                  <div className="mt-auto flex gap-2 pt-1">
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(s)}>
                      {t('library.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs text-red-400"
                      onClick={() => {
                        deleteCustom('scenarios', s.id);
                        refresh();
                      }}
                    >
                      {t('library.delete')}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
}
