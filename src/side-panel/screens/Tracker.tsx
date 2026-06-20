import React, { useState, useMemo } from 'react';
import { useStore } from '../../shared/store';
import { Application, ApplicationStatus } from '../../shared/types';
import { Pin, Mail, ClipboardList, Calendar, Award, XCircle, ArrowLeft, Search } from 'lucide-react';

// ─── Column & Status config ──────────────────────────────────────────────────

const COLUMNS: Array<{ id: ApplicationStatus; label: string; color: string; icon: React.ComponentType<any> }> = [
  { id: 'saved',      label: 'Saved',       color: '#64748b', icon: Pin },
  { id: 'applied',    label: 'Applied',      color: '#3b82f6', icon: Mail },
  { id: 'assessment', label: 'Assessment',   color: '#f59e0b', icon: ClipboardList },
  { id: 'interview',  label: 'Interview',    color: '#8b5cf6', icon: Calendar },
  { id: 'offer',      label: 'Offer',        color: '#10b981', icon: Award },
  { id: 'rejected',   label: 'Rejected',     color: '#ef4444', icon: XCircle },
  { id: 'withdrawn',  label: 'Withdrawn',    color: '#94a3b8', icon: ArrowLeft },
];

// Helper to format timestamps for <input type="datetime-local"> in local timezone
const formatTimestampForInput = (ts?: number) => {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const date = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${date}T${hours}:${minutes}`;
};

// ─── Application Card ─────────────────────────────────────────────────────────

function TrackerCard({ app, onClick }: { app: Application; onClick: () => void }) {
  const statusConfig = COLUMNS.find(c => c.id === app.status);
  const color = statusConfig?.color || '#cbd5e1';

  return (
    <div
      onClick={onClick}
      className="bg-surface-dark100 border border-white/8 rounded-2xl p-4 cursor-pointer hover:border-brand-500/30 hover:bg-surface-dark200/80 transition-all duration-200 group select-none flex items-center justify-between gap-4 shadow-sm"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Status color indicator dot */}
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-gray-200 truncate group-hover:text-white transition-colors">
            {app.company}
          </h3>
        </div>
        <p className="text-xs text-gray-500 truncate mt-1 pl-4.5">{app.role}</p>

        <div className="flex items-center gap-2 mt-3 pl-4.5 flex-wrap">
          {app.salary && (
            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {app.salary}
            </span>
          )}
          <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 capitalize font-medium">
            {app.status}
          </span>
          {app.remindAt && app.remindAt > Date.now() && (
            <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
              ⏰ {new Date(app.remindAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0">
        <span className="text-[10px] text-gray-500 font-medium">
          {new Date(app.appliedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

// ─── App Detail Sheet ─────────────────────────────────────────────────────────

function AppDetailSheet({ app, onClose }: { app: Application; onClose: () => void }) {
  const { updateApplication, deleteApplication, showToast } = useStore();
  const [notes, setNotes] = useState(app.notes || '');
  const [status, setStatus] = useState<ApplicationStatus>(app.status);
  const [reminderDate, setReminderDate] = useState(formatTimestampForInput(app.remindAt));
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const updates: Partial<Application> = { notes, status };
    if (reminderDate) {
      updates.remindAt = new Date(reminderDate).getTime();
    } else {
      updates.remindAt = undefined;
    }
    await updateApplication(app.id, updates);
    showToast('Application updated!', 'success');
    setIsSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this application?')) return;
    await deleteApplication(app.id);
    showToast('Application deleted.', 'info');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[300px] bg-surface-dark50 border-l border-white/10 flex flex-col animate-slide-right overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-white/6">
          <div className="flex-1 overflow-hidden">
            <div className="text-base font-bold text-white truncate">{app.company}</div>
            <div className="text-xs text-gray-500 truncate">{app.role}</div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 ml-2 transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 px-5 py-4 flex flex-col gap-4">
          {/* Status Selector */}
          <div>
            <div className="section-label mb-2">Status</div>
            <div className="grid grid-cols-2 gap-1.5">
              {COLUMNS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setStatus(c.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all ${status === c.id ? 'text-white' : 'text-gray-500 bg-white/5 hover:bg-white/8'}`}
                  style={status === c.id ? { background: `${c.color}30`, border: `1px solid ${c.color}60`, color: c.color } : {}}
                >
                  <c.icon size={13} className="shrink-0" /> {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Platform + Date */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="section-label mb-1">Platform</div>
              <div className="text-gray-300 font-medium capitalize">{app.platform?.replace('_', ' ')}</div>
            </div>
            <div>
              <div className="section-label mb-1">Applied</div>
              <div className="text-gray-300 font-medium">
                {new Date(app.appliedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Link */}
          {app.url && (
            <a href={app.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-brand-400 hover:text-brand-300 underline truncate transition-colors">
              Open Job Posting
            </a>
          )}

          {/* Salary */}
          {app.salary && (
            <div>
              <div className="section-label mb-1">Salary / Stipend</div>
              <div className="text-sm text-emerald-400 font-semibold">{app.salary}</div>
            </div>
          )}

          {/* Reminder */}
          <div>
            <div className="section-label mb-1.5">⏰ Follow-up Reminder</div>
            <input type="datetime-local" value={reminderDate} onChange={e => setReminderDate(e.target.value)}
              className="input-field-dark text-xs w-full" />
          </div>

          {/* Notes */}
          <div className="flex-1">
            <div className="section-label mb-1.5">Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes, contact info, interview details..."
              rows={5}
              className="input-field-dark text-xs resize-none w-full"
            />
          </div>

          {/* Job Description */}
          {app.jobDescription && (
            <div>
              <div className="section-label mb-1.5">Job Description (excerpt)</div>
              <div className="bg-white/5 rounded-xl p-3 text-xs text-gray-500 leading-relaxed max-h-24 overflow-y-auto">
                {app.jobDescription.substring(0, 400)}...
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2 border-t border-white/6 pt-4">
          <button onClick={handleDelete} className="text-xs text-red-500 hover:text-red-400 font-semibold transition-colors px-2">Delete</button>
          <div className="flex-1" />
          <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-400 font-semibold transition-colors px-3 py-2">Cancel</button>
          <button onClick={handleSave} disabled={isSaving}
            className="gradient-premium text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-60 hover:opacity-90 transition-all">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tracker Screen ────────────────────────────────────────────────────────────

export default function Tracker() {
  const { applications } = useStore();
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [filterText, setFilterText] = useState('');
  const [activeStatus, setActiveStatus] = useState<ApplicationStatus | 'all'>('all');

  // Compute counts for each status
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: applications.length };
    COLUMNS.forEach(c => {
      map[c.id] = applications.filter(app => app.status === c.id).length;
    });
    return map;
  }, [applications]);

  // Filter and sort the list
  const filteredList = useMemo(() => {
    let list = applications;
    if (activeStatus !== 'all') {
      list = list.filter(a => a.status === activeStatus);
    }
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      list = list.filter(a => `${a.company} ${a.role}`.toLowerCase().includes(q));
    }
    // Sort by applied date descending (latest first)
    return [...list].sort((a, b) => b.appliedAt - a.appliedAt);
  }, [applications, activeStatus, filterText]);

  return (
    <div className="flex flex-col h-full bg-surface-dark overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/6 shrink-0">
        <div className="flex-none">
          <h1 className="text-base font-bold text-white">Tracker</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {applications.length === 1 ? '1 application' : `${applications.length} applications`}
          </p>
        </div>
        <div className="flex-1 max-w-[180px] ml-auto relative">
          <input
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filter by company..."
            className="input-field-dark text-xs w-full pl-8"
          />
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        </div>
      </div>

      {/* Horizontal Status Chips Bar */}
      <div className="px-5 pt-3.5 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status Filters</span>
        <span className="text-[9px] text-gray-500 font-medium animate-pulse">Scroll right for more →</span>
      </div>
      <div
        className="flex gap-2 overflow-x-auto px-5 pb-3 pt-1.5 shrink-0 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* 'All' Chip */}
        <button
          onClick={() => setActiveStatus('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
            activeStatus === 'all'
              ? 'gradient-premium text-white shadow-lg shadow-brand-500/10 border-transparent'
              : 'bg-white/5 text-gray-400 border border-white/6 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span>All</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeStatus === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-500'}`}>
            {counts['all']}
          </span>
        </button>

        {/* Status Columns Chips */}
        {COLUMNS.map(col => {
          const isActive = activeStatus === col.id;
          const Icon = col.icon;
          return (
            <button
              key={col.id}
              onClick={() => setActiveStatus(col.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 border ${
                isActive
                  ? 'text-white border-transparent'
                  : 'bg-white/5 text-gray-400 border-white/6 hover:bg-white/10 hover:text-white'
              }`}
              style={isActive ? { backgroundColor: `${col.color}25`, borderColor: `${col.color}50`, color: col.color } : {}}
            >
              <Icon size={12} className="shrink-0" />
              <span>{col.label}</span>
              <span
                className="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
                style={isActive ? { backgroundColor: `${col.color}20`, color: col.color } : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}
              >
                {counts[col.id] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Applications Vertical List */}
      <div className="flex-1 overflow-y-auto px-5 py-2 flex flex-col gap-2.5 pb-6">
        {filteredList.map(app => (
          <TrackerCard key={app.id} app={app} onClick={() => setSelectedApp(app)} />
        ))}
        {filteredList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-2xl mb-2">💼</span>
            <p className="text-xs text-gray-400 font-semibold">No applications found</p>
            <p className="text-[10px] text-gray-600 mt-1 max-w-[200px]">Try resetting filters or save a job to add a new tracker entry</p>
          </div>
        )}
      </div>

      {/* App Detail Sheet */}
      {selectedApp && (
        <AppDetailSheet app={selectedApp} onClose={() => setSelectedApp(null)} />
      )}
    </div>
  );
}
