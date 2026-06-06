import { useState, useEffect, useRef, useCallback } from 'react';
import useWebSocket from '../hooks/useWebSocket';
import { getTasks, triggerEvent } from '../api/tasks';
import StatsCards from './StatsCards';
import TaskTable from './TaskTable';
import SubmitModal from './SubmitModal';

/* ─── Filter chip definitions ─────────────────────── */
const FILTERS = [
  { key: 'all', label: 'All', statKey: 'total' },
  { key: 'pending', label: 'Pending', statKey: 'pending' },
  { key: 'running', label: 'Running', statKey: 'running' },
  { key: 'done', label: 'Done', statKey: 'done' },
  { key: 'failed', label: 'Failed', statKey: 'failed' },
];

const FLOWS = [
  { key: 'all', label: 'All Flows' },
  { key: 'PLACE_ORDER', label: '🍔 Food Delivery' },
  { key: 'SUBMIT_KYC', label: '🏦 FinTech KYC' },
  { key: 'BULK_USER_IMPORT', label: '📊 Enterprise Import' },
];

export default function Dashboard() {
  const { stats, isConnected } = useWebSocket();
  const [tasks, setTasks] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeFlowFilter, setActiveFlowFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const previousTaskIdsRef = useRef(new Set());

  /* ── Fetch tasks ── */
  const fetchTasks = useCallback(async () => {
    try {
      const filters = {};
      if (activeFilter !== 'all') {
        filters.status = activeFilter;
      }
      if (activeFlowFilter !== 'all') {
        filters.root_event = activeFlowFilter;
      }
      const data = await getTasks(filters);
      const taskList = Array.isArray(data) ? data : data?.tasks ?? [];
      setTasks(taskList);
    } catch (err) {
      console.warn('Failed to fetch tasks:', err);
    }
  }, [activeFilter, activeFlowFilter]);

  /* ── Poll tasks every 3s ── */
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  /* ── Track previous task IDs for highlight detection ── */
  const currentTaskIds = new Set(tasks.map((t) => t.id));
  const previousTaskIds = previousTaskIdsRef.current;

  useEffect(() => {
    // Update previous IDs after render so the next fetch can diff
    previousTaskIdsRef.current = new Set(tasks.map((t) => t.id));
  }, [tasks]);

  /* ── Submit handler ── */
  const handleSubmit = async (eventData) => {
    await triggerEvent(eventData);
    // Give backend a moment then refresh
    setTimeout(fetchTasks, 500);
  };

  return (
    <div className="bg-mesh min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ═══════════════════════════════════════════
            Header
            ═══════════════════════════════════════════ */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-100 text-glow">
              Task Queue Orchestration Engine
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Real-time Distributed Flow Monitor
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection status */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {isConnected ? (
                  <>
                    <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </>
                ) : (
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                )}
              </span>
              <span
                className={`text-xs font-semibold ${
                  isConnected ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isConnected ? 'Live' : 'Disconnected'}
              </span>
            </div>

            {/* Trigger button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="
                inline-flex items-center gap-2 px-5 py-2.5
                text-sm font-semibold text-white
                bg-gradient-to-r from-cyan-600 to-blue-600
                hover:from-cyan-500 hover:to-blue-500
                rounded-xl shadow-lg shadow-cyan-500/10
                hover:shadow-cyan-500/25
                transition-all duration-300
                active:scale-[0.97]
              "
            >
              🚀 Trigger Flow
            </button>
          </div>
        </header>

        {/* ═══════════════════════════════════════════
            Stats Cards
            ═══════════════════════════════════════════ */}
        <section className="mb-8">
          <StatsCards stats={stats} />
        </section>

        {/* ═══════════════════════════════════════════
            Filter Chips
            ═══════════════════════════════════════════ */}
        <section className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-600 mr-2 w-16">
              Status
            </span>
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.key;
              const count = stats?.[f.statKey] ?? 0;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`
                    inline-flex items-center gap-1.5 px-3.5 py-1.5
                    text-xs font-semibold rounded-lg
                    transition-all duration-200
                    ${
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-400/30'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                    }
                  `}
                >
                  {f.label}
                  <span
                    className={`
                      text-[10px] tabular-nums px-1.5 py-0.5 rounded-md
                      ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-slate-800/60 text-slate-600'
                      }
                    `}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            Flow Filters
            ═══════════════════════════════════════════ */}
        <section className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-600 mr-2 w-16">
              Flow
            </span>
            {FLOWS.map((flow) => {
              const isActive = activeFlowFilter === flow.key;
              return (
                <button
                  key={flow.key}
                  onClick={() => setActiveFlowFilter(flow.key)}
                  className={`
                    inline-flex items-center gap-1.5 px-3.5 py-1.5
                    text-xs font-semibold rounded-lg
                    transition-all duration-200
                    ${
                      isActive
                        ? 'bg-violet-500/15 text-violet-400 ring-1 ring-violet-400/30'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                    }
                  `}
                >
                  {flow.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* ═══════════════════════════════════════════
            Task Table
            ═══════════════════════════════════════════ */}
        <section>
          <TaskTable tasks={tasks} previousTaskIds={previousTaskIds} />
        </section>

        {/* ═══════════════════════════════════════════
            Footer
            ═══════════════════════════════════════════ */}
        <footer className="mt-10 pb-6 text-center">
          <p className="text-[11px] text-slate-700">
            Distributed Task Queue Orchestration Engine • Built with Go + React + Redis
          </p>
        </footer>
      </div>

      {/* ═══════════════════════════════════════════
          Submit Modal
          ═══════════════════════════════════════════ */}
      <SubmitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
