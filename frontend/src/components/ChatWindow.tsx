import axios from 'axios';
import {
  Bot, Code, Database, Lightbulb, Loader2, Send, User,
  BarChart2, AlertTriangle, Cpu, Sparkles, ChevronDown, ChevronUp,
  Paperclip, LayoutDashboard
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ChartViewer from './ChartViewer';
import Markdown from './Markdown';

export interface Message {
  id:        string;
  sender:    'user' | 'ai';
  text:      string;
  chart?:    any;
  sql?:      string;
  code?:     string;
  insights?: string;
  reasoning?:string;
  anomalies?:any[];
  agentMode?:string;
  timestamp?:number;
}

interface ArtifactBlock {
  id:       string;
  type:     'chart' | 'sql' | 'code' | 'insights' | 'anomalies' | 'reasoning';
  label:    string;
  icon:     any;
  color:    string;
  content:  any;
  expanded: boolean;
}

function buildArtifacts(msg: Message): ArtifactBlock[] {
  const blocks: ArtifactBlock[] = [];
  if (msg.chart)    blocks.push({ id:'chart',    type:'chart',    label:'Visualization', icon:BarChart2,    color:'#818cf8', content:msg.chart,    expanded:true  });
  if (msg.insights) blocks.push({ id:'insights', type:'insights', label:'Key Insights',  icon:Lightbulb,   color:'#fbbf24', content:msg.insights, expanded:true  });
  if (msg.sql)      blocks.push({ id:'sql',      type:'sql',      label:'SQL Query',     icon:Database,    color:'#34d399', content:msg.sql,      expanded:true  });
  if (msg.code)     blocks.push({ id:'code',     type:'code',     label:'Pandas Code',   icon:Code,        color:'#60a5fa', content:msg.code,     expanded:true  });
  if (msg.anomalies?.length)
                    blocks.push({ id:'anomalies',type:'anomalies',label:`${msg.anomalies.length} Anomalies`,icon:AlertTriangle,color:'#f87171',content:msg.anomalies,expanded:true});
  if (msg.reasoning)blocks.push({ id:'reasoning',type:'reasoning',label:'Agent Trace',   icon:Cpu,         color:'#a78bfa', content:msg.reasoning,expanded:false });
  return blocks;
}

const QUICK_PROMPTS = [
  'Show me a summary of this dataset',
  'What are the top 10 rows?',
  'Plot a distribution chart',
  'Detect any anomalies'
];

const AGENT_MODES = [
  { id: 'auto',     label: 'Auto',    icon: Sparkles      },
  { id: 'sql',      label: 'SQL',     icon: Database      },
  { id: 'pandas',   label: 'Pandas',  icon: Code          },
  { id: 'graph',    label: 'Graph',   icon: BarChart2     },
  { id: 'anomaly',  label: 'Anomaly', icon: AlertTriangle },
  { id: 'insights', label: 'AI',      icon: Lightbulb     },
];

export default function ChatWindow({
  sessionId, activeDatasets, isDarkMode, agentMode, setAgentMode, onMessagesUpdate,
}: {
  sessionId:        string;
  activeDatasets:   string[];
  isDarkMode:       boolean;
  agentMode:        string;
  setAgentMode:     (mode: string) => void;
  onMessagesUpdate?:(allMessages: Message[]) => void;
}) {
  const [chatHistory, setChatHistory] = useState<Record<string, Message[]>>({
    auto:[], sql:[], pandas:[], graph:[], anomaly:[], insights:[],
  });
  const messages = chatHistory[agentMode] || [];
  const [input,     setInput]     = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [expandedArtifacts, setExpandedArtifacts] = useState<Record<string, Record<string, boolean>>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, agentMode]);

  // Load session messages when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      setChatHistory({
        auto:[], sql:[], pandas:[], graph:[], anomaly:[], insights:[],
      });
      return;
    }

    axios.get(`http://localhost:8000/api/sessions/${sessionId}`)
      .then(res => {
        const dbMessages = res.data.messages || [];
        const historyMap: Record<string, Message[]> = {
          auto:[], sql:[], pandas:[], graph:[], anomaly:[], insights:[],
        };

        dbMessages.forEach((m: any) => {
          const mode = m.agent_mode || 'auto';
          if (historyMap[mode]) {
            historyMap[mode].push({
              id: m.id.toString(),
              sender: m.sender,
              text: m.text,
              chart: m.extras?.chart,
              sql: m.extras?.sql,
              code: m.extras?.code,
              insights: m.extras?.insights,
              anomalies: m.extras?.anomalies,
              timestamp: new Date(m.timestamp).getTime(),
              agentMode: mode
            });
          }
        });
        setChatHistory(historyMap);
      })
      .catch((err) => {
        console.error("Failed to load session history", err);
      });
  }, [sessionId]);

  // Bubble all messages upward for report generation
  useEffect(() => {
    const all = Object.values(chatHistory).flat();
    onMessagesUpdate?.(all);
  }, [chatHistory]);

  const toggleArtifact = (msgId: string, blockId: string) => {
    setExpandedArtifacts(prev => ({
      ...prev,
      [msgId]: { ...(prev[msgId] ?? {}), [blockId]: !(prev[msgId]?.[blockId] ?? true) },
    }));
  };

  const isBlockExpanded = (msgId: string, blockId: string, defaultVal: boolean) =>
    expandedArtifacts[msgId]?.[blockId] ?? defaultVal;

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || activeDatasets.length === 0) return;

    const userMsg: Message = {
      id: Date.now().toString(), sender: 'user', text: msg,
      agentMode, timestamp: Date.now(),
    };

    const aiMsgId = (Date.now() + 1).toString();
    const initAiMsg: Message = {
      id: aiMsgId, sender: 'ai', text: '',
      agentMode, timestamp: Date.now(),
    };

    setChatHistory(prev => ({
      ...prev,
      [agentMode]: [...(prev[agentMode] || []), userMsg, initAiMsg]
    }));
    setInput('');
    setIsLoading(true);
    setProgressMessage('Supervisor is organizing pipeline...');

    try {
      const token = localStorage.getItem('insightai_token');
      const response = await fetch('http://localhost:8000/api/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message:    msg,
          session_id: sessionId,
          files:      activeDatasets,
          agent_mode: agentMode,
          history:    messages.slice(-10).map(m => ({ sender: m.sender, text: m.text })),
        })
      });

      if (!response.body) throw new Error('Response body is null');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let buffer = '';
      let replyText = '';
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete block in the buffer
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            try {
              const data = JSON.parse(dataStr);
              
              if (data.text !== undefined) {
                replyText += data.text;
                setChatHistory(prev => {
                  const history = prev[agentMode] || [];
                  const updated = history.map(m => {
                    if (m.id === aiMsgId) {
                      return { ...m, text: replyText };
                    }
                    return m;
                  });
                  return { ...prev, [agentMode]: updated };
                });
              } else if (data.step !== undefined) {
                setProgressMessage(data.message);
              } else if (data.message !== undefined && data.reasoning !== undefined && data.chart === undefined) {
                // This matches the error structure
                setChatHistory(prev => {
                  const history = prev[agentMode] || [];
                  const updated = history.map(m => {
                    if (m.id === aiMsgId) {
                      return { ...m, text: data.message, reasoning: data.reasoning };
                    }
                    return m;
                  });
                  return { ...prev, [agentMode]: updated };
                });
              } else {
                // Final result payload
                setChatHistory(prev => {
                  const history = prev[agentMode] || [];
                  const updated = history.map(m => {
                    if (m.id === aiMsgId) {
                      return {
                        ...m,
                        text:      data.message || replyText || 'Analysis complete.',
                        chart:     data.chart,
                        sql:       data.sql,
                        code:      data.code,
                        insights:  data.insights,
                        reasoning: data.reasoning,
                        anomalies: data.anomalies,
                      };
                    }
                    return m;
                  });
                  return { ...prev, [agentMode]: updated };
                });
              }
            } catch (err) {
              console.error('Error parsing stream line:', line, err);
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Streaming failed:', error);
      setChatHistory(prev => {
        const history = prev[agentMode] || [];
        const updated = history.map(m => {
          if (m.id === aiMsgId) {
            return {
              ...m,
              text: 'Sorry, I encountered an error processing your request.',
              reasoning: error.message,
            };
          }
          return m;
        });
        return { ...prev, [agentMode]: updated };
      });
    } finally {
      setIsLoading(false);
      setProgressMessage(null);
    }
  };

  const getAgentLabel = () => {
    const map: Record<string, string> = {
      sql:'SQL Agent', pandas:'Pandas Agent', graph:'Graph Agent',
      anomaly:'Anomaly Agent', insights:'Insights Agent', auto:'Auto-Pilot',
    };
    return map[agentMode] ?? 'Agent';
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-transparent overflow-hidden transition-colors duration-300">

      {/* ── Dataset Header ── */}
      <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/80 dark:bg-slate-950/20 flex items-center justify-between flex-shrink-0 transition-colors duration-300">
        <div className="flex items-center gap-2">
          <Database size={13} className="text-indigo-500 dark:text-indigo-400" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {activeDatasets.length > 0
              ? (activeDatasets.length === 1 ? activeDatasets[0] : `${activeDatasets.length} Datasets Selected`)
              : 'Select Dataset'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-600 font-semibold cursor-pointer hover:text-indigo-500 dark:hover:text-slate-400 transition-colors">
          <LayoutDashboard size={11} />
          <span>Inspector</span>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 p-5 overflow-y-auto space-y-6 custom-scrollbar scroll-smooth bg-white dark:bg-transparent transition-colors duration-300">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in px-4">
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 dark:from-indigo-500/10 to-purple-50 dark:to-purple-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center animate-float">
                <Sparkles size={28} className="text-indigo-500 dark:text-indigo-400" />
              </div>
            </div>

            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-100 mb-1.5 max-w-sm leading-normal">
              Welcome to <span className="gradient-text">InsightAI</span>
            </h3>

            <p className="text-slate-400 dark:text-slate-500 text-xs max-w-sm mb-6 leading-relaxed">
              {activeDatasets.length > 0
                ? "Select an agent mode from the bar below and ask any question — I'll analyze, visualize, and explain."
                : "Select or upload a CSV dataset from the sidebar to begin your analysis."}
            </p>

            {/* Suggestion chips */}
            {activeDatasets.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {QUICK_PROMPTS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-[10px] px-3.5 py-1.5 rounded-full
                      bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80
                      text-slate-500 dark:text-slate-400
                      hover:border-indigo-300 dark:hover:border-indigo-500/30
                      hover:text-indigo-600 dark:hover:text-indigo-300
                      hover:bg-indigo-50 dark:hover:bg-indigo-500/5
                      transition-all duration-200 cursor-pointer font-medium"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages list */}
        {messages.map((msg, idx) => {
          const artifacts = buildArtifacts(msg);
          const hasContent = msg.sender === 'user' || (msg.text && msg.text.trim() !== '') || artifacts.length > 0;
          if (!hasContent) return null;
          return (
            <div
              key={msg.id}
              className={`flex gap-3 animate-slide-up ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
              style={{ animationDelay: `${Math.min(idx * 0.04, 0.25)}s` }}
            >
              {/* Avatar */}
              <div className="flex-shrink-0 mt-0.5">
                {msg.sender === 'user' ? (
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                    <User size={17} />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-gradient-to-br dark:from-slate-700 dark:to-slate-900 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shadow-md">
                    <Bot size={17} />
                  </div>
                )}
              </div>

              {/* Bubble + artifacts */}
              <div className={`max-w-[90%] md:max-w-[85%] ${msg.sender === 'ai' ? 'w-full' : ''} flex flex-col gap-3 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.text && (
                  <div
                    className={`px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-sm
                      ${msg.sender === 'user'
                        ? 'msg-user text-white rounded-tr-sm'
                        : 'msg-ai rounded-tl-sm'
                      }`}
                  >
                    {msg.sender === 'user' ? msg.text : <Markdown content={msg.text} />}
                  </div>
                )}

                {/* Artifact blocks */}
                {msg.sender === 'ai' && artifacts.length > 0 && (
                  <div className="flex flex-col gap-3 w-full">
                    {artifacts.map((block, bi) => {
                      const Icon = block.icon;
                      const open = isBlockExpanded(msg.id, block.id, block.expanded);
                      return (
                        <div
                          key={block.id}
                          className="w-full rounded-2xl overflow-hidden border bg-white dark:bg-slate-900/60 backdrop-blur-sm animate-scale-in shadow-md dark:shadow-xl transition-colors duration-300"
                          style={{
                            animationDelay: `${bi * 0.08}s`,
                            borderColor: `${block.color}30`,
                            boxShadow: `0 2px 16px rgba(0,0,0,0.06), 0 0 0 1px ${block.color}15`,
                          }}
                        >
                          <button
                            onClick={() => toggleArtifact(msg.id, block.id)}
                            className="w-full flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                            style={{ borderBottom: open ? `1px solid ${block.color}20` : 'none' }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg" style={{ background: `${block.color}20`, border: `1px solid ${block.color}30` }}>
                                <Icon size={11} style={{ color: block.color }} />
                              </div>
                              <span className="text-xs font-semibold" style={{ color: block.color }}>{block.label}</span>
                            </div>
                            {open
                              ? <ChevronUp   size={13} className="text-slate-400 dark:text-slate-500" />
                              : <ChevronDown size={13} className="text-slate-400 dark:text-slate-500" />
                            }
                          </button>

                          {open && (
                            <div className="p-4">
                              {block.type === 'chart' && <ChartViewer config={block.content} isDarkMode={isDarkMode} />}
                              {block.type === 'insights' && (
                                <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                  <Markdown content={block.content} />
                                </div>
                              )}
                              {(block.type === 'sql' || block.type === 'code') && (
                                <pre
                                  className="text-[12px] font-mono overflow-x-auto leading-relaxed custom-scrollbar whitespace-pre-wrap bg-slate-50 dark:bg-transparent p-2 rounded-lg"
                                  style={{ color: block.type === 'sql' ? '#059669' : '#2563eb' }}
                                >
                                  {block.content}
                                </pre>
                              )}
                              {block.type === 'anomalies' && (
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                  {(block.content as any[]).map((a: any, i: number) => (
                                    <div key={i} className="text-xs p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-500/20">
                                      <span className="text-red-500 dark:text-red-400 font-bold mr-2">#{i + 1}</span>
                                      <span className="text-slate-500 dark:text-slate-400">
                                        {Object.entries(a).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {block.type === 'reasoning' && (
                                <pre className="text-[11px] text-purple-600 dark:text-purple-300/80 font-mono leading-relaxed whitespace-pre-wrap custom-scrollbar overflow-x-auto max-h-40">
                                  {block.content}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {isLoading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-9 h-9 flex-shrink-0 mt-0.5 rounded-xl bg-slate-100 dark:bg-gradient-to-br dark:from-slate-700 dark:to-slate-900 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shadow-md">
              <Loader2 size={17} className="animate-spin" />
            </div>
            <div className="msg-ai rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {progressMessage || 'Agents are thinking'}
              </span>
              <div className="flex gap-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Panel ── */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-950/40 p-4 transition-colors duration-300">

        {/* Agent mode bar */}
        <div className="max-w-4xl mx-auto w-full mb-3">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Agent Mode</div>
          <div className="grid grid-cols-3 md:grid-cols-6 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 p-1 gap-1 transition-colors duration-300">
            {AGENT_MODES.map(mode => {
              const Icon = mode.icon;
              const active = agentMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setAgentMode(mode.id)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all duration-150 cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800/40'
                  }`}
                >
                  <Icon size={12} />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Textarea block */}
        <div className="max-w-4xl mx-auto w-full rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-900/30 p-2.5 shadow-sm dark:shadow-2xl transition-colors duration-300">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder={activeDatasets.length > 0 ? "Ask anything about your data..." : "Upload a dataset first..."}
            disabled={activeDatasets.length === 0 || isLoading}
            className="w-full bg-transparent text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none text-xs resize-none overflow-hidden leading-relaxed px-2.5 pt-1.5 disabled:opacity-50"
            style={{ minHeight: '38px', maxHeight: '140px' }}
          />

          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/50 mt-2.5 pt-2.5 px-1">
            <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
              <button className="hover:text-indigo-500 dark:hover:text-slate-300 transition-colors cursor-pointer" disabled={activeDatasets.length === 0}>
                <Paperclip size={13} />
              </button>
              <button className="hover:text-indigo-500 dark:hover:text-slate-300 transition-colors cursor-pointer" disabled={activeDatasets.length === 0}>
                <BarChart2 size={13} />
              </button>
              <div className="w-px h-3 bg-slate-200 dark:bg-slate-800" />
              <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-semibold bg-slate-100 dark:bg-slate-800/20 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                <Sparkles size={9} className="text-indigo-500 dark:text-indigo-400 animate-pulse" />
                <span>{getAgentLabel()}</span>
              </div>
            </div>

            <button
              onClick={() => sendMessage()}
              disabled={isLoading || activeDatasets.length === 0 || !input.trim()}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer shadow-md shadow-indigo-500/20"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
