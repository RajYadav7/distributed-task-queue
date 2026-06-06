import { useState, useEffect, useCallback } from 'react';

/* ─── Event type definitions ──────────────────────── */
const EVENT_TYPES = [
  {
    key: 'PLACE_ORDER',
    emoji: '🍔',
    title: 'Food Delivery Order',
    subtitle: 'Triggers SMS, Email, Restaurant Alert, GPS Matching',
    accent: 'emerald',
    ring: 'ring-emerald-500/40',
    bg: 'bg-emerald-500/10',
    bgActive: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
    borderActive: 'border-emerald-400/60',
    text: 'text-emerald-400',
    btnGradient: 'from-emerald-600 to-emerald-500',
    payload: JSON.stringify(
      {
        customer_id: 'CUST-9281',
        order_id: 'ORD-20240115-001',
        items: ['Butter Chicken', 'Naan x2', 'Mango Lassi'],
        restaurant: 'Punjab Grill',
        delivery_address: '42 MG Road, Bangalore',
        total_amount: 850.0,
      },
      null,
      2
    ),
  },
  {
    key: 'SUBMIT_KYC',
    emoji: '🏦',
    title: 'FinTech KYC Onboarding',
    subtitle: 'Triggers PAN Verify, AML Check, Risk Score',
    accent: 'blue',
    ring: 'ring-blue-500/40',
    bg: 'bg-blue-500/10',
    bgActive: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    borderActive: 'border-blue-400/60',
    text: 'text-blue-400',
    btnGradient: 'from-blue-600 to-blue-500',
    payload: JSON.stringify(
      {
        applicant_id: 'APP-7823',
        pan_number: 'ABCDE1234F',
        full_name: 'Rajesh Kumar',
        dob: '1992-05-15',
        annual_income: 1200000,
        employment_type: 'salaried',
      },
      null,
      2
    ),
  },
  {
    key: 'BULK_USER_IMPORT',
    emoji: '📊',
    title: 'Enterprise Bulk Import',
    subtitle: 'Triggers CSV Parse, IAM Provision, Token Gen',
    accent: 'violet',
    ring: 'ring-violet-500/40',
    bg: 'bg-violet-500/10',
    bgActive: 'bg-violet-500/20',
    border: 'border-violet-500/30',
    borderActive: 'border-violet-400/60',
    text: 'text-violet-400',
    btnGradient: 'from-violet-600 to-violet-500',
    payload: JSON.stringify(
      {
        org_id: 'ORG-ACME-001',
        file_url: 's3://hr-imports/employees-q1-2024.csv',
        total_records: 2500,
        department: 'Engineering',
        role_template: 'IC-L4',
        notify_managers: true,
      },
      null,
      2
    ),
  },
];

export default function SubmitModal({ isOpen, onClose, onSubmit }) {
  const [selected, setSelected] = useState(EVENT_TYPES[0]);
  const [payload, setPayload] = useState(EVENT_TYPES[0].payload);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync payload when selection changes
  const handleSelect = useCallback((evt) => {
    setSelected(evt);
    setPayload(evt.payload);
    setError('');
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelected(EVENT_TYPES[0]);
      setPayload(EVENT_TYPES[0].payload);
      setLoading(false);
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setError('');
    try {
      JSON.parse(payload);
    } catch {
      setError('Invalid JSON payload');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        event: selected.key,
        payload: payload,
      });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up"
        style={{
          border: '1px solid rgba(75, 85, 99, 0.25)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* ── Header ── */}
        <div className="px-7 pt-7 pb-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              Trigger Flow Event
            </h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800/60"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Select an event type and customize the payload before launching.
          </p>
        </div>

        {/* ── Event type selector ── */}
        <div className="px-7 pt-5 pb-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {EVENT_TYPES.map((evt) => {
            const isActive = selected.key === evt.key;
            return (
              <button
                key={evt.key}
                onClick={() => handleSelect(evt)}
                className={`
                  text-left rounded-xl p-4 border transition-all duration-200
                  ${
                    isActive
                      ? `${evt.bgActive} ${evt.borderActive} shadow-lg`
                      : `bg-slate-800/40 border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-800/60`
                  }
                `}
              >
                <div className="text-2xl mb-2">{evt.emoji}</div>
                <div
                  className={`text-sm font-semibold mb-1 ${
                    isActive ? evt.text : 'text-slate-300'
                  }`}
                >
                  {evt.title}
                </div>
                <div className="text-[11px] text-slate-500 leading-relaxed">
                  {evt.subtitle}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Payload editor ── */}
        <div className="px-7 pt-4 pb-2">
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
            Event Payload (JSON)
          </label>
          <textarea
            value={payload}
            onChange={(e) => {
              setPayload(e.target.value);
              setError('');
            }}
            rows={10}
            spellCheck={false}
            className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl px-4 py-3 font-mono text-xs text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all placeholder-slate-600"
            placeholder="Enter JSON payload…"
          />
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="px-7 pt-1">
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              ⚠️ {error}
            </p>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="px-7 pt-5 pb-7 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`
              px-6 py-2.5 text-sm font-semibold text-white rounded-xl
              bg-gradient-to-r ${selected.btnGradient}
              hover:shadow-lg hover:shadow-${selected.accent}-500/20
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 flex items-center gap-2
            `}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Launching…
              </>
            ) : (
              '🚀 Launch Flow'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
