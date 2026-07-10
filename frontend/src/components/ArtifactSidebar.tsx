import { useState } from 'react';
import ChartViewer from './ChartViewer';
import Markdown from './Markdown';
import { Database, Code, Lightbulb, Activity, BarChart2, AlertTriangle, Cpu } from 'lucide-react';

interface ArtifactSidebarProps {
  artifacts: {
    chart?:     any;
    sql?:       string;
    code?:      string;
    insights?:  string;
    reasoning?: string;
    anomalies?: any[];
  };
  isDarkMode: boolean;
}

const TABS = [
  { id: 'chart',     label: 'Visualization', icon: BarChart2,    color: '#818cf8' },
  { id: 'insights',  label: 'Insights',       icon: Lightbulb,   color: '#fbbf24' },
  { id: 'sql',       label: 'SQL',            icon: Database,    color: '#34d399' },
  { id: 'pandas',    label: 'Pandas',         icon: Code,        color: '#60a5fa' },
  { id: 'anomalies', label: 'Anomalies',      icon: AlertTriangle, color: '#f87171' },
  { id: 'trace',     label: 'Agent Trace',    icon: Cpu,         color: '#a78bfa' },
];

export default function ArtifactSidebar({ artifacts, isDarkMode }: ArtifactSidebarProps) {
  const availableTabs = TABS.filter(t => {
    if (t.id === 'chart')     return !!artifacts?.chart;
    if (t.id === 'insights')  return !!artifacts?.insights;
    if (t.id === 'sql')       return !!artifacts?.sql;
    if (t.id === 'pandas')    return !!artifacts?.code;
    if (t.id === 'anomalies') return !!(artifacts?.anomalies && artifacts.anomalies.length > 0);
    if (t.id === 'trace')     return !!artifacts?.reasoning;
    return false;
  });

  const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || '');

  if (availableTabs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-500 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center animate-pulse-glow">
          <Activity size={28} className="opacity-40" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-400">No artifacts yet</p>
          <p className="text-xs text-slate-600 mt-1">Run a query to see results here</p>
        </div>
      </div>
    );
  }

  const activeTabMeta = TABS.find(t => t.id === activeTab);

  return (
    <div className="h-full flex flex-col overflow-hidden animate-slide-in-right">
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-lg bg-indigo-500/15 border border-indigo-500/25">
            <Activity size={16} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-200">Analysis Workspace</h2>
            <p className="text-xs text-slate-500">{availableTabs.length} artifact{availableTabs.length !== 1 ? 's' : ''} ready</p>
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar flex-wrap">
          {availableTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="tab-pill"
                style={isActive ? {
                  background: `linear-gradient(135deg, ${tab.color}25, ${tab.color}15)`,
                  borderColor: `${tab.color}50`,
                  color: tab.color,
                  boxShadow: `0 0 12px ${tab.color}20`,
                  border: `1px solid ${tab.color}50`,
                } : {}}
              >
                <Icon size={11} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

        {/* Visualization */}
        {activeTab === 'chart' && artifacts.chart && (
          <div className="animate-fade-in">
            <ChartViewer config={artifacts.chart} isDarkMode={isDarkMode} />
          </div>
        )}

        {/* Insights */}
        {activeTab === 'insights' && artifacts.insights && (
          <div className="animate-fade-in insight-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-amber-400/15 border border-amber-400/25">
                <Lightbulb size={13} className="text-amber-400" />
              </div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Key Insights</span>
            </div>
            <div className="text-slate-200 text-sm leading-relaxed">
              <Markdown content={artifacts.insights} />
            </div>
          </div>
        )}

        {/* SQL */}
        {activeTab === 'sql' && artifacts.sql && (
          <div className="code-block animate-fade-in">
            <div className="code-header">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
              <span className="ml-2 text-xs font-semibold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Database size={11} /> DuckDB SQL
              </span>
            </div>
            <pre className="p-5 text-emerald-300 text-[13px] font-mono overflow-x-auto leading-relaxed custom-scrollbar whitespace-pre-wrap">
              {artifacts.sql}
            </pre>
          </div>
        )}

        {/* Pandas */}
        {activeTab === 'pandas' && artifacts.code && (
          <div className="code-block animate-fade-in">
            <div className="code-header">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
              <span className="ml-2 text-xs font-semibold text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Code size={11} /> Python / Pandas
              </span>
            </div>
            <pre className="p-5 text-blue-300 text-[13px] font-mono overflow-x-auto leading-relaxed custom-scrollbar whitespace-pre-wrap">
              {artifacts.code}
            </pre>
          </div>
        )}

        {/* Anomalies */}
        {activeTab === 'anomalies' && artifacts.anomalies && artifacts.anomalies.length > 0 && (
          <div className="animate-fade-in flex flex-col gap-3">
            <div className="anomaly-card flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-bold text-sm">
                  {artifacts.anomalies.length} Anomal{artifacts.anomalies.length === 1 ? 'y' : 'ies'} Detected
                </p>
                <p className="text-red-400/70 text-xs mt-0.5 leading-relaxed">
                  These records statistically deviate from typical patterns using Isolation Forest.
                </p>
              </div>
            </div>

            {artifacts.anomalies.map((anomaly: any, idx: number) => (
              <div
                key={idx}
                className="anomaly-card animate-slide-up"
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                <div className="text-[10px] font-bold text-red-400/80 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-[9px]">
                    {idx + 1}
                  </span>
                  Anomaly Record
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {Object.entries(anomaly).map(([key, val]) => (
                    <div key={key} className="contents">
                      <dt className="text-slate-500 truncate">{key}</dt>
                      <dd className="font-semibold text-slate-200 truncate text-right">{String(val)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}

        {/* Agent Trace */}
        {activeTab === 'trace' && artifacts.reasoning && (
          <div className="code-block animate-fade-in">
            <div className="code-header">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
              <span className="ml-2 text-xs font-semibold text-purple-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Cpu size={11} /> Agent Execution Trace
              </span>
            </div>
            <pre className="p-5 text-purple-200/80 text-[12px] font-mono overflow-x-auto leading-relaxed custom-scrollbar whitespace-pre-wrap">
              {artifacts.reasoning}
            </pre>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      {activeTabMeta && (
        <div className="px-5 py-2.5 border-t border-slate-800/60 flex items-center gap-2 flex-shrink-0">
          <activeTabMeta.icon size={11} style={{ color: activeTabMeta.color }} />
          <span className="text-[10px] text-slate-600" style={{ color: `${activeTabMeta.color}80` }}>
            Viewing {activeTabMeta.label}
          </span>
        </div>
      )}
    </div>
  );
}
