import { useEffect, useState } from 'react';

const cards = [
  {
    key: 'total',
    label: 'Total',
    icon: '⚡',
    gradient: 'from-slate-500 to-slate-400',
    border: 'bg-gradient-to-r from-slate-500/60 to-slate-400/40',
    text: 'text-slate-200',
    glow: 'rgba(148,163,184,0.10)',
  },
  {
    key: 'pending',
    label: 'Pending',
    icon: '⏳',
    gradient: 'from-amber-500 to-yellow-400',
    border: 'bg-gradient-to-r from-amber-500/60 to-yellow-400/40',
    text: 'text-amber-400',
    glow: 'rgba(245,158,11,0.10)',
  },
  {
    key: 'running',
    label: 'Running',
    icon: '🔄',
    gradient: 'from-cyan-500 to-blue-400',
    border: 'bg-gradient-to-r from-cyan-500/60 to-blue-400/40',
    text: 'text-cyan-400',
    glow: 'rgba(6,182,212,0.10)',
  },
  {
    key: 'done',
    label: 'Done',
    icon: '✅',
    gradient: 'from-emerald-500 to-green-400',
    border: 'bg-gradient-to-r from-emerald-500/60 to-green-400/40',
    text: 'text-emerald-400',
    glow: 'rgba(16,185,129,0.10)',
  },
  {
    key: 'failed',
    label: 'Failed',
    icon: '💀',
    gradient: 'from-rose-500 to-red-400',
    border: 'bg-gradient-to-r from-rose-500/60 to-red-400/40',
    text: 'text-rose-400',
    glow: 'rgba(244,63,94,0.10)',
  },
];

export default function StatsCards({ stats }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((card, idx) => (
        <div
          key={card.key}
          className={`
            glass-card glow-border rounded-2xl overflow-hidden
            transform transition-all duration-300
            hover:scale-[1.03] hover:shadow-2xl
            cursor-default select-none
            ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
          `}
          style={{
            transitionDelay: `${idx * 100}ms`,
            boxShadow: `0 4px 24px ${card.glow}`,
          }}
        >
          {/* Gradient top border accent */}
          <div className={`h-[3px] w-full ${card.border}`} />

          <div className="px-5 py-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg">{card.icon}</span>
              <span className={`text-[11px] font-semibold uppercase tracking-widest ${card.text} opacity-60`}>
                {card.label}
              </span>
            </div>

            <div className={`text-4xl font-black tabular-nums tracking-tight ${card.text}`}>
              {stats?.[card.key] ?? 0}
            </div>

            <div className="mt-2 text-[11px] text-slate-500 font-medium">
              {card.label === 'Total'
                ? 'All pipeline tasks'
                : card.label === 'Pending'
                ? 'Awaiting processing'
                : card.label === 'Running'
                ? 'Currently executing'
                : card.label === 'Done'
                ? 'Successfully completed'
                : 'Needs attention'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
