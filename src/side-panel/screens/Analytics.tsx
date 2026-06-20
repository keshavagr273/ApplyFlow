import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, FunnelChart, Funnel, LabelList
} from 'recharts';
import { useStore } from '../../shared/store';

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: '#0077b5', internshala: '#00aaff', unstop: '#f59e0b',
  workday: '#f59e0b', greenhouse: '#10b981', lever: '#4a6cf7',
  smartrecruiters: '#aa3bff', naukri: '#ef4444', indeed: '#003A9B',
  company_site: '#64748b',
};

const STATUS_COLORS: Record<string, string> = {
  saved: '#64748b', applied: '#3b82f6', assessment: '#f59e0b',
  interview: '#8b5cf6', offer: '#10b981', rejected: '#ef4444', withdrawn: '#94a3b8',
};

const TOOLTIP_STYLE = {
  backgroundColor: '#1e2536', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px', color: '#e2e8f0', fontSize: '11px',
};

export default function Analytics() {
  const { applications } = useStore();

  // ── Weekly applications data ──────────────────────────────────────────────

  const weeklyData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toLocaleDateString('en-US', { weekday: 'short' });
      days[key] = 0;
    }
    applications
      .filter(a => a.appliedAt >= now - 7 * 86400000)
      .forEach(a => {
        const key = new Date(a.appliedAt).toLocaleDateString('en-US', { weekday: 'short' });
        days[key] = (days[key] || 0) + 1;
      });
    return Object.entries(days).map(([day, count]) => ({ day, count }));
  }, [applications]);

  // ── Platform distribution ─────────────────────────────────────────────────

  const platformData = useMemo(() => {
    const counts: Record<string, number> = {};
    applications.forEach(a => {
      const p = a.platform || 'company_site';
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, color: PLATFORM_COLORS[name] || '#64748b' }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [applications]);

  // ── Funnel (status breakdown) ─────────────────────────────────────────────

  const funnelData = useMemo(() => {
    const statuses = ['applied', 'assessment', 'interview', 'offer'];
    return statuses.map(s => ({
      name: s.charAt(0).toUpperCase() + s.slice(1),
      value: applications.filter(a => a.status === s).length,
      fill: STATUS_COLORS[s],
    })).filter(d => d.value > 0);
  }, [applications]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const applied = applications.filter(a => a.status !== 'saved').length;
    const interviews = applications.filter(a => a.status === 'interview').length;
    const offers = applications.filter(a => a.status === 'offer').length;
    const interviewRate = applied > 0 ? Math.round((interviews / applied) * 100) : 0;
    const offerRate = interviews > 0 ? Math.round((offers / interviews) * 100) : 0;
    return { applied, interviews, offers, interviewRate, offerRate };
  }, [applications]);

  if (applications.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-surface-dark gap-4">
        <div className="text-5xl animate-float">📊</div>
        <div className="text-sm font-bold text-gray-300">No data yet</div>
        <div className="text-xs text-gray-600 text-center max-w-[200px]">
          Start applying to jobs and your analytics will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-dark overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-white/6">
        <h1 className="text-base font-bold text-white">Analytics</h1>
        <p className="text-xs text-gray-500 mt-0.5">{applications.length} total applications</p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-6">
        {/* Conversion Rates */}
        <div>
          <div className="section-label mb-3">Conversion Rates</div>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="Applied" value={stats.applied} icon="✉️"
              color="text-blue-400" bg="rgba(59,130,246,0.1)"
            />
            <MetricCard
              label="Interview Rate" value={`${stats.interviewRate}%`} icon="🎤"
              color="text-purple-400" bg="rgba(139,92,246,0.1)"
            />
            <MetricCard
              label="Offer Rate" value={`${stats.offerRate}%`} icon="🎉"
              color="text-emerald-400" bg="rgba(16,185,129,0.1)"
            />
          </div>
        </div>

        {/* Weekly Activity Chart */}
        <div>
          <div className="section-label mb-3">Applications This Week</div>
          <div className="bg-surface-dark50 border border-white/8 rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" fill="#4a6cf7" radius={[4, 4, 0, 0]} name="Applications" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel */}
        {funnelData.length > 0 && (
          <div>
            <div className="section-label mb-3">Application Funnel</div>
            <div className="bg-surface-dark50 border border-white/8 rounded-2xl p-4">
              <div className="flex flex-col gap-2">
                {funnelData.map(d => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className="text-xs text-gray-400 font-medium w-20 shrink-0">{d.name}</div>
                    <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{
                          width: `${(d.value / (funnelData[0]?.value || 1)) * 100}%`,
                          background: d.fill,
                        }}
                      >
                        <span className="text-[9px] text-white font-bold">{d.value}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Platform Breakdown */}
        {platformData.length > 0 && (
          <div>
            <div className="section-label mb-3">Top Platforms</div>
            <div className="bg-surface-dark50 border border-white/8 rounded-2xl p-4">
              <div className="flex gap-4 items-center">
                {/* Donut chart */}
                <div className="shrink-0">
                  <ResponsiveContainer width={100} height={100}>
                    <PieChart>
                      <Pie
                        data={platformData}
                        cx="50%" cy="50%"
                        innerRadius={28} outerRadius={46}
                        dataKey="value" paddingAngle={2}
                      >
                        {platformData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex flex-col gap-1.5 flex-1">
                  {platformData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-gray-400 capitalize flex-1 truncate">
                        {d.name.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-bold text-gray-300">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status breakdown */}
        <div>
          <div className="section-label mb-3">Status Breakdown</div>
          <div className="bg-surface-dark50 border border-white/8 rounded-2xl p-4">
            <div className="flex flex-col gap-2">
              {Object.entries(STATUS_COLORS).map(([status, color]) => {
                const count = applications.filter(a => a.status === status).length;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-xs text-gray-400 capitalize flex-1">{status}</span>
                    <div className="w-20 bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(count / applications.length) * 100}%`, background: color }} />
                    </div>
                    <span className="text-xs font-bold text-gray-300 w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, icon, color, bg }: {
  label: string; value: string | number; icon: string; color: string; bg: string;
}) {
  return (
    <div className="border border-white/8 rounded-2xl p-3 text-center" style={{ background: bg }}>
      <div className="text-xl mb-1">{icon}</div>
      <div className={`text-lg font-black ${color}`}>{value}</div>
      <div className="text-[9px] text-gray-600 font-semibold uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
