import type { Product } from '@/types';
import { useT } from '@/i18n';

/**
 * Battle card / playbook de um produto: proposta de valor, respostas a
 * objeções, concorrentes e preço — a munição de referência do SDR. Renderiza
 * só as seções que o produto tem preenchidas.
 */
export function BattleCard({ product }: { product: Product }) {
  const { t } = useT();
  const heading = (label: string) => (
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
  );

  return (
    <div className="space-y-3">
      {product.key_features.length > 0 && (
        <div>
          {heading(t('battle.valueProps'))}
          <ul className="space-y-1">
            {product.key_features.map((f, i) => (
              <li key={i} className="text-xs text-slate-400">
                <span className="font-medium text-slate-200">{f.feature}</span> — {f.benefit}
              </li>
            ))}
          </ul>
        </div>
      )}

      {product.common_objections.length > 0 && (
        <div>
          {heading(t('battle.objections'))}
          <ul className="space-y-1.5">
            {product.common_objections.map((o, i) => (
              <li key={i} className="text-xs leading-relaxed">
                <span className="italic text-amber-300">“{o.objection}”</span>
                <span className="text-slate-400"> → {o.model_answer}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {product.competitors.length > 0 && (
        <div>
          {heading(t('battle.competitors'))}
          <ul className="space-y-1">
            {product.competitors.map((c, i) => (
              <li key={i} className="text-xs text-slate-400">
                <span className="font-medium text-slate-200">{c.name}</span> — {c.key_difference}
              </li>
            ))}
          </ul>
        </div>
      )}

      {product.pricing_notes && (
        <div>
          {heading(t('battle.pricing'))}
          <p className="text-xs text-slate-400">{product.pricing_notes}</p>
        </div>
      )}
    </div>
  );
}
