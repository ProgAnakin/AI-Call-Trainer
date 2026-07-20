import type { WeeklyPoint } from '@/hooks/useProgress';

/**
 * Gráfico de linha SVG (sem libs) da média semanal de nota — evolução real
 * ao longo das semanas de treino.
 */
export function ProgressChart({ data }: { data: WeeklyPoint[] }) {
  if (data.length === 0) return null;

  const W = 560;
  const H = 180;
  const PAD = 28;
  const xs = (i: number) =>
    data.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (data.length - 1);
  const ys = (score: number) => H - PAD - (score / 100) * (H - PAD * 2);

  const path = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(p.avgScore)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weekly score chart">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line
            x1={PAD}
            x2={W - PAD}
            y1={ys(v)}
            y2={ys(v)}
            className="stroke-slate-800"
            strokeDasharray="3 5"
          />
          <text x={2} y={ys(v) + 3} className="fill-slate-600 text-[9px] font-mono">
            {v}
          </text>
        </g>
      ))}

      <path d={path} fill="none" strokeWidth="2.5" className="stroke-indigo-400" strokeLinecap="round" />

      {data.map((p, i) => (
        <g key={p.weekStart}>
          <circle cx={xs(i)} cy={ys(p.avgScore)} r="4" className="fill-indigo-400" />
          <text
            x={xs(i)}
            y={ys(p.avgScore) - 9}
            textAnchor="middle"
            className="fill-slate-300 text-[10px] font-mono font-bold"
          >
            {p.avgScore}
          </text>
          <text x={xs(i)} y={H - 8} textAnchor="middle" className="fill-slate-600 text-[9px]">
            {p.weekStart.slice(5)}
          </text>
        </g>
      ))}
    </svg>
  );
}
