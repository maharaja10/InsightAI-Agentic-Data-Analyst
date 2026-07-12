import { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../utils/api';
import {
  FileText, Download, BarChart2, MessageSquare, Sparkles,
  Database, Code, AlertTriangle, Lightbulb, Clock, Filter,
  TrendingUp, Copy, CheckCircle, Folder
} from 'lucide-react';
import { type Message } from './ChatWindow';
import Markdown from './Markdown';

interface ReportsTabProps {
  sessions:  any[];
  datasets:  string[];
}

const AGENT_COLORS: Record<string, { color: string; bg: string; icon: any }> = {
  auto:     { color: '#818cf8', bg: 'rgba(129,140,248,0.15)', icon: Sparkles      },
  sql:      { color: '#34d399', bg: 'rgba(52,211,153,0.15)',  icon: Database      },
  pandas:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  icon: Code          },
  graph:    { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', icon: BarChart2     },
  anomaly:  { color: '#f87171', bg: 'rgba(248,113,113,0.15)', icon: AlertTriangle },
  insights: { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  icon: Lightbulb     },
};

function formatTime(ts?: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildReportMarkdown(messages: Message[], datasets: string[], sessionName?: string): string {
  const lines: string[] = [
    `# InsightAI — ${sessionName || 'Analysis Report'}`,
    `**Generated:** ${new Date().toLocaleString()}`,
    `**Datasets:** ${datasets.join(', ') || 'N/A'}`,
    `**Total exchanges:** ${Math.floor(messages.length / 2)} Q&A pairs`,
    '',
    '---',
    '',
  ];

  const aiMsgs = messages.filter(m => m.sender === 'ai');
  const userMsgs = messages.filter(m => m.sender === 'user');

  if (userMsgs.length === 0) {
    lines.push('*No conversation history available. Start chatting to generate a report.*');
    return lines.join('\n');
  }

  lines.push('## Executive Summary', '');
  lines.push(`This report documents **${userMsgs.length} queries** asked across **${Object.keys(AGENT_COLORS).filter(k => messages.some(m => m.agentMode === k)).length} agent modes**.`);
  lines.push('');

  // Insights section
  const insights = aiMsgs.filter(m => m.insights);
  if (insights.length) {
    lines.push('---', '', '## Key Business Insights', '');
    insights.forEach((m, i) => {
      lines.push(`### Insight ${i + 1}`, m.insights ?? '', '');
    });
  }

  // Queries section
  lines.push('---', '', '## Full Q&A Log', '');
  let qi = 1;
  messages.forEach(m => {
    if (m.sender === 'user') {
      lines.push(`### Query ${qi++}: ${m.text.slice(0, 80)}${m.text.length > 80 ? '…' : ''}`, '');
    } else {
      lines.push(`**Agent response:**`, '', m.text, '');
      if (m.sql)  lines.push('**SQL:**', '```sql', m.sql, '```', '');
      if (m.code) lines.push('**Code:**', '```python', m.code, '```', '');
    }
  });

  return lines.join('\n');
}

export default function ReportsTab({ sessions, datasets }: ReportsTabProps) {
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(() => {
    return sessions.length > 0 ? sessions[0].session_key : null;
  });
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Set default selection when sessions load
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionKey) {
      setSelectedSessionKey(sessions[0].session_key);
    }
  }, [sessions, selectedSessionKey]);

  // Load session messages on selection change
  useEffect(() => {
    if (!selectedSessionKey) {
      setSessionMessages([]);
      return;
    }

    setLoading(true);
    axios.get(`${API_BASE_URL}/api/sessions/${selectedSessionKey}`)
      .then(res => {
        const dbMessages = res.data.messages || [];
        const msgs = dbMessages.map((m: any) => ({
          id: m.id.toString(),
          sender: m.sender,
          text: m.text,
          chart: m.extras?.chart,
          sql: m.extras?.sql,
          code: m.extras?.code,
          insights: m.extras?.insights,
          anomalies: m.extras?.anomalies,
          timestamp: new Date(m.timestamp).getTime(),
          agentMode: m.agent_mode || 'auto'
        }));
        setSessionMessages(msgs);
      })
      .catch(err => {
        console.error("Failed to load report session messages", err);
      })
      .finally(() => setLoading(false));
  }, [selectedSessionKey]);

  const selectedSessionName = useMemo(() => {
    const s = sessions.find(x => x.session_key === selectedSessionKey);
    return s ? s.session_name : '';
  }, [sessions, selectedSessionKey]);

  const aiMessages = useMemo(() => sessionMessages.filter(m => m.sender === 'ai'), [sessionMessages]);
  const userMessages = useMemo(() => sessionMessages.filter(m => m.sender === 'user'), [sessionMessages]);
  const hasCharts  = useMemo(() => aiMessages.some(m => m.chart), [aiMessages]);
  const hasInsights = useMemo(() => aiMessages.some(m => m.insights), [aiMessages]);
  const hasAnomalies = useMemo(() => aiMessages.some(m => m.anomalies?.length), [aiMessages]);
  const hasSQL = useMemo(() => aiMessages.some(m => m.sql), [aiMessages]);
  const hasCode = useMemo(() => aiMessages.some(m => m.code), [aiMessages]);

  const filteredMessages = useMemo(() => {
    if (activeFilter === 'all') return sessionMessages;
    if (activeFilter === 'questions') return sessionMessages.filter(m => m.sender === 'user');
    if (activeFilter === 'insights') return sessionMessages.filter(m => m.insights);
    if (activeFilter === 'charts') return sessionMessages.filter(m => m.chart);
    if (activeFilter === 'anomalies') return sessionMessages.filter(m => m.anomalies?.length);
    return sessionMessages.filter(m => m.agentMode === activeFilter);
  }, [sessionMessages, activeFilter]);

  const reportMarkdown = useMemo(() => buildReportMarkdown(sessionMessages, datasets, selectedSessionName), [sessionMessages, datasets, selectedSessionName]);

  const handleDownload = () => {
    const blob = new Blob([reportMarkdown], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${selectedSessionName || 'InsightAI'}_Report_${new Date().toISOString().slice(0,10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Summary stats
  const stats = [
    { label: 'Total Queries',    value: userMessages.length, icon: MessageSquare, color: 'indigo' },
    { label: 'AI Responses',     value: aiMessages.length,   icon: Sparkles,      color: 'purple' },
    { label: 'Visualizations',   value: aiMessages.filter(m => m.chart).length,    icon: BarChart2,     color: 'violet' },
    { label: 'Anomalies Found',  value: aiMessages.filter(m => m.anomalies?.length).length, icon: AlertTriangle, color: 'red' },
  ];

  const filters = [
    { id: 'all',       label: 'All'       },
    { id: 'questions', label: 'Questions' },
    { id: 'insights',  label: 'Insights'  },
    { id: 'charts',    label: 'Charts'    },
    { id: 'anomalies', label: 'Anomalies' },
  ];

  if (sessions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center animate-fade-in px-8 py-12 bg-slate-50/50 dark:bg-transparent transition-colors duration-300">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 dark:from-indigo-500/10 to-purple-50 dark:to-purple-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center mb-5 animate-float">
          <FileText size={28} className="text-indigo-500 dark:text-indigo-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-100 mb-2">No Report Sessions Available Yet</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm text-center leading-relaxed mb-6">
          Create a chat session and start a conversation with the agents to view your reports.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden bg-slate-50/50 dark:bg-transparent transition-colors duration-300">

      {/* ── Left: Report Summary Panel ── */}
      <div className="w-72 border-r border-slate-200 dark:border-slate-900 flex flex-col overflow-hidden bg-white dark:bg-slate-950/40 flex-shrink-0 transition-colors duration-300">

        {/* ── Session Selector card ── */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-900 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Folder size={11} className="text-slate-400 dark:text-slate-500" />
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Select Chat Session</span>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 overflow-hidden max-h-32 overflow-y-auto custom-scrollbar">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {sessions.map(s => {
                const selected = selectedSessionKey === s.session_key;
                return (
                  <li
                    key={s.session_key}
                    onClick={() => setSelectedSessionKey(s.session_key)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                      selected ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800/30 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <MessageSquare size={11} className={selected ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'} />
                    <span className="text-[11px] truncate font-medium flex-1">{s.session_name}</span>
                    {selected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Header + actions */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-900 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-indigo-500 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Analysis Report</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                disabled={sessionMessages.length === 0}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/40 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 disabled:opacity-40 disabled:hover:text-slate-450 transition-colors cursor-pointer"
                title="Copy as Markdown"
              >
                {copied ? <CheckCircle size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </button>
              <button
                onClick={handleDownload}
                disabled={sessionMessages.length === 0}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors cursor-pointer shadow-sm shadow-indigo-500/20"
                title="Download Report"
              >
                <Download size={12} />
              </button>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 dark:text-slate-600">
            <span>Generated {new Date().toLocaleDateString()}</span>
            {datasets.length > 0 && <span className="ml-1.5">· {datasets[0]}</span>}
          </div>
        </div>

        {/* Stats grid */}
        <div className="p-4 grid grid-cols-2 gap-2.5 flex-shrink-0 border-b border-slate-100 dark:border-slate-900">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60">
              <Icon size={12} className="text-indigo-400 mb-1" />
              <span className="block text-base font-black text-slate-700 dark:text-slate-100">{value}</span>
              <span className="block text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide leading-tight">{label}</span>
            </div>
          ))}
        </div>

        {/* Artifact breakdown */}
        <div className="p-4 flex-shrink-0 border-b border-slate-100 dark:border-slate-900">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">Artefacts</p>
          <div className="space-y-1.5">
            {[
              { label: 'Insights Generated', active: hasInsights, icon: Lightbulb,     color: '#fbbf24' },
              { label: 'Charts Created',     active: hasCharts,   icon: BarChart2,     color: '#818cf8' },
              { label: 'SQL Queries',        active: hasSQL,      icon: Database,      color: '#34d399' },
              { label: 'Python Code',        active: hasCode,     icon: Code,          color: '#60a5fa' },
              { label: 'Anomalies',          active: hasAnomalies,icon: AlertTriangle, color: '#f87171' },
            ].map(({ label, active, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: active ? `${color}20` : undefined }}>
                  <Icon size={10} style={{ color: active ? color : '#94a3b8' }} />
                </div>
                <span className={`text-[11px] font-medium flex-1 ${active ? 'text-slate-600 dark:text-slate-300' : 'text-slate-300 dark:text-slate-700'}`}>{label}</span>
                {active && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Download CTA */}
        <div className="p-4 mt-auto">
          <button
            onClick={handleDownload}
            disabled={sessionMessages.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors cursor-pointer shadow-md shadow-indigo-500/20"
          >
            <Download size={13} />
            Download Full Report
          </button>
        </div>
      </div>

      {/* ── Right: Report Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/20 flex items-center gap-3 flex-shrink-0 transition-colors duration-300">
          <Filter size={12} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
          <div className="flex items-center gap-1.5 flex-wrap">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeFilter === f.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-600 font-medium">
            {filteredMessages.length} items
          </span>
        </div>

        {/* Timeline / Loader */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <TrendingUp size={24} className="text-indigo-500 dark:text-indigo-400 animate-pulse" />
              <p className="text-xs text-slate-400 dark:text-slate-500">Loading analysis timeline...</p>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <TrendingUp size={20} className="text-slate-200 dark:text-slate-700 mb-2" />
              <p className="text-xs text-slate-400 dark:text-slate-600">No items match this filter or session is empty</p>
            </div>
          ) : (
            filteredMessages.map((msg, idx) => {
              const agentInfo = AGENT_COLORS[msg.agentMode ?? 'auto'] ?? AGENT_COLORS.auto;
              const AgentIcon = agentInfo.icon;
              return (
                <div
                  key={msg.id ?? idx}
                  className={`rounded-2xl border overflow-hidden transition-colors duration-300 animate-slide-up ${
                    msg.sender === 'user'
                      ? 'bg-indigo-50 dark:bg-indigo-500/5 border-indigo-100 dark:border-indigo-500/15'
                      : 'bg-white dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60'
                  }`}
                  style={{ animationDelay: `${idx * 0.03}s` }}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: agentInfo.bg }}
                      >
                        <AgentIcon size={11} style={{ color: agentInfo.color }} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 capitalize">
                        {msg.sender === 'user' ? 'User Query' : `${msg.agentMode ?? 'Auto'} Agent`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-600">
                      <Clock size={10} />
                      <span>{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-3">
                    {msg.sender === 'user' ? (
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium leading-relaxed">{msg.text}</p>
                    ) : (
                      <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <Markdown content={msg.text} />
                      </div>
                    )}

                    {/* Artifact badges */}
                    {msg.sender === 'ai' && (msg.chart || msg.sql || msg.code || msg.insights || msg.anomalies?.length) && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/50">
                        {msg.chart    && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 font-semibold">📊 Chart</span>}
                        {msg.insights && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 font-semibold">💡 Insights</span>}
                        {msg.sql      && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-semibold">🗄️ SQL</span>}
                        {msg.code     && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-semibold">🐍 Code</span>}
                        {msg.anomalies?.length && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 font-semibold">⚠️ {msg.anomalies.length} Anomalies</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
