import { useMemo } from 'react';

/* ─── Domain colour-coding ────────────────────────── */
const FLOW_MAP = {
  PLACE_ORDER: {
    emoji: '🍔',
    label: 'Food Delivery Flow',
    colorHex: '#10b981',
    gradient: 'from-emerald-500 to-teal-400',
    glow: 'rgba(16,185,129,0.12)',
  },
  SUBMIT_KYC: {
    emoji: '🏦',
    label: 'FinTech KYC Onboarding Flow',
    colorHex: '#3b82f6',
    gradient: 'from-blue-500 to-indigo-400',
    glow: 'rgba(59,130,246,0.12)',
  },
  BULK_USER_IMPORT: {
    emoji: '📊',
    label: 'Enterprise Bulk Import Flow',
    colorHex: '#8b5cf6',
    gradient: 'from-violet-500 to-fuchsia-400',
    glow: 'rgba(139,92,246,0.12)',
  },
};

const STATUS_CONFIG = {
  pending: {
    pill: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-400/20',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    animate: false,
  },
  running: {
    pill: 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-400/20',
    dot: 'bg-cyan-400',
    text: 'text-cyan-400',
    animate: true,
  },
  done: {
    pill: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/20',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    animate: false,
  },
  failed: {
    pill: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-400/20',
    dot: 'bg-rose-400',
    text: 'text-rose-400',
    animate: false,
  },
};

function relativeTime(dateStr) {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.pill}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {cfg.animate && (
          <span className={`absolute inset-0 rounded-full ${cfg.dot} opacity-75 animate-ping`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      </span>
      {status}
    </span>
  );
}

export default function TaskTable({ tasks, previousTaskIds }) {
  // Group tasks by group_id
  const runs = useMemo(() => {
    if (!tasks || !Array.isArray(tasks)) return [];

    const groups = {};
    tasks.forEach((task) => {
      const gId = task.group_id || 'unassigned';
      if (!groups[gId]) {
        groups[gId] = {
          id: gId,
          root_event: task.root_event,
          created_at: task.created_at,
          tasks: [],
        };
      }
      groups[gId].tasks.push(task);
    });

    // Convert to array and sort by created_at DESC
    return Object.values(groups).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [tasks]);

  if (!runs.length) {
    return (
      <div className="glass-card glow-border rounded-2xl p-16 text-center">
        <div className="text-5xl mb-4">🚀</div>
        <h3 className="text-xl font-bold text-slate-300 mb-2">
          No orchestration flows triggered yet
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Hit the <span className="text-cyan-400 font-semibold">"Trigger Flow"</span> button
          above to launch your first distributed flow and watch it execute in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {runs.map((run) => {
        const flow = FLOW_MAP[run.root_event] || {
          emoji: '⚙️',
          label: run.root_event || 'General Flow',
          colorHex: '#64748b',
          gradient: 'from-slate-500 to-slate-400',
          glow: 'rgba(148,163,184,0.1)',
        };

        // Calculate aggregate stats
        const totalSubTasks = run.tasks.length;
        const doneCount = run.tasks.filter((t) => t.status === 'done').length;
        const failedCount = run.tasks.filter((t) => t.status === 'failed').length;
        const runningCount = run.tasks.filter((t) => t.status === 'running').length;

        const progressPercent = totalSubTasks > 0 ? Math.round((doneCount / totalSubTasks) * 100) : 0;

        let runStatus = 'pending';
        if (failedCount > 0) {
          runStatus = 'failed';
        } else if (runningCount > 0) {
          runStatus = 'running';
        } else if (doneCount === totalSubTasks) {
          runStatus = 'done';
        }

        const isNew = run.tasks.some((t) => previousTaskIds && !previousTaskIds.has(t.id));

        return (
          <div
            key={run.id}
            className={`
              glass-card rounded-2xl overflow-hidden
              transform transition-all duration-350 hover:shadow-2xl
              ${isNew ? 'animate-highlight' : ''}
            `}
            style={{
              borderLeft: `4px solid ${flow.colorHex}`,
              boxShadow: `0 8px 30px ${flow.glow}`,
            }}
          >
            {/* Run Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="text-3xl p-2 bg-slate-800/60 rounded-xl border border-slate-700/30">
                  {flow.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-100 text-base sm:text-lg">
                      {flow.label}
                    </h3>
                    <StatusPill status={runStatus} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-slate-500">
                    <span className="bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/20">
                      Flow ID: {run.id.substring(0, 8)}
                    </span>
                    <span>•</span>
                    <span>Triggered {relativeTime(run.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Progress Panel */}
              <div className="flex flex-col sm:items-end justify-center min-w-[200px]">
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full text-xs font-semibold mb-2">
                  <span className="text-slate-500">Flow Execution Status</span>
                  <span className={`font-mono ${STATUS_CONFIG[runStatus].text} text-xs font-bold`}>
                    {progressPercent}% ({doneCount}/{totalSubTasks} tasks done)
                  </span>
                </div>
                {/* Custom Sleek Progress Bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700/20">
                  <div
                    className={`h-full bg-gradient-to-r ${flow.gradient} transition-all duration-500 rounded-full`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Run Body: Isolated Sub-Tasks */}
            <div className="px-5 py-5 sm:px-6 bg-slate-900/10">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-3.5">
                Micro-Concurrency Isolated Task Lanes
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {run.tasks.map((task) => {
                  const tStatus = task.status || 'pending';
                  const isTaskNew = previousTaskIds && !previousTaskIds.has(task.id);
                  const statusInfo = STATUS_CONFIG[tStatus];

                  return (
                    <div
                      key={task.id}
                      className={`
                        bg-slate-800/30 border border-slate-800/80 rounded-xl p-4
                        transition-all duration-300 hover:border-slate-700/50 hover:bg-slate-800/40
                        flex flex-col justify-between min-h-[140px]
                        ${isTaskNew ? 'ring-1 ring-cyan-500/20' : ''}
                      `}
                    >
                      {/* Sub-Task Info */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <code className="text-xs font-mono font-bold text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/40">
                            {task.type}
                          </code>
                          <span className={`inline-flex items-center h-2 w-2 rounded-full ${statusInfo.dot} ${statusInfo.animate ? 'animate-pulse' : ''}`} />
                        </div>
                        
                        <div className="text-[10px] font-mono text-slate-500 flex flex-col gap-1 mt-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-600">Queue:</span>
                            <span className="text-slate-400 break-all">{task.queue_name}</span>
                          </div>
                        </div>
                      </div>

                      {/* Sub-Task Stats / State */}
                      <div className="mt-4 pt-3 border-t border-slate-800/40 flex items-center justify-between text-[11px]">
                        <span className={`font-semibold uppercase tracking-wider text-[10px] ${statusInfo.text}`}>
                          {tStatus}
                        </span>
                        
                        <div className="font-mono text-slate-500 flex items-center gap-1">
                          <span>Retry:</span>
                          <span className={task.retries > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                            {task.retries ?? 0}/{task.max_retry ?? 3}
                          </span>
                        </div>
                      </div>

                      {/* Error message box if failed */}
                      {task.error_msg && (
                        <div className="mt-3 text-[10px] text-rose-400 bg-rose-500/5 border border-rose-500/10 rounded p-2 font-mono break-all max-h-[85px] overflow-y-auto">
                          ❌ {task.error_msg}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
