import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Upload from './components/Upload';
import ChatWindow from './components/ChatWindow';
import ReportsTab from './components/ReportsTab';
import ChartViewer from './components/ChartViewer';
import AuthPage from './pages/AuthPage';
import { useAuth } from './context/AuthContext';

import {
  Database, Moon, Sun, Sparkles,
  Lightbulb, Zap, FileSpreadsheet,
  Trash2, LayoutDashboard, MessageSquare,
  UploadCloud, BarChart3, Settings, User, Bell, Search,
  Shield, Database as StorageIcon,
  CheckCircle, X, ChevronRight, Folder, LogOut,
  AlertTriangle, ShieldCheck, TrendingUp, Activity, Award, Eye, EyeOff
} from 'lucide-react';

export default function App() {
  const { user, logout, loading: authLoading } = useAuth();
  const toggleTheme = (theme: "dark" | "light") => {
    setAppTheme(theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };
  const [datasets, setDatasets] = useState<string[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [activeAgentMode, setActiveAgentMode] = useState<string>('auto');
  const [activeNavTab, setActiveNavTab] = useState<string>('dashboard');
  const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);

  const [qualityReport, setQualityReport] = useState<any>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [selectedQualityFile, setSelectedQualityFile] = useState<string | null>(null);

  const [schemaSearchQuery, setSchemaSearchQuery] = useState('');
  const [schemaSearchResults, setSchemaSearchResults] = useState<any[]>([]);
  const [isSearchingSchemas, setIsSearchingSchemas] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [evalsExpanded, setEvalsExpanded] = useState(false);
  const [evalsReport, setEvalsReport] = useState<any>(null);
  const [evalsLoading, setEvalsLoading] = useState(false);

  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
  const [securityExpanded, setSecurityExpanded] = useState(false);
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [storageExpanded, setStorageExpanded] = useState(false);

  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSound, setNotifSound] = useState(false);
  const [notifAlert, setNotifAlert] = useState(true);

  const [customApiKey, setCustomApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false);
  const [securityStatusMsg, setSecurityStatusMsg] = useState<string | null>(null);
  const [securityStatusType, setSecurityStatusType] = useState<'success' | 'error'>('success');
  const [advancedSettingsExpanded, setAdvancedSettingsExpanded] = useState(false);
  const [apiKeyStatusMsg, setApiKeyStatusMsg] = useState<string | null>(null);
  const [apiKeyStatusType, setApiKeyStatusType] = useState<'success' | 'error'>('success');

  const [appTheme, setAppTheme] = useState("dark");
  const [appFontSize, setAppFontSize] = useState(localStorage.getItem("appFontSize") || "standard");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (appFontSize === 'compact') {
      root.style.fontSize = '14px';
    } else if (appFontSize === 'comfortable') {
      root.style.fontSize = '18px';
    } else {
      root.style.fontSize = '16px';
    }
    localStorage.setItem("appFontSize", appFontSize);
  }, [appFontSize]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const showSecurityStatus = (msg: string, type: 'success' | 'error') => {
    setSecurityStatusMsg(msg);
    setSecurityStatusType(type);
    setTimeout(() => setSecurityStatusMsg(null), 4000);
  };

  const handleUpdateSecurity = async () => {
    if (!currentPassword && !newPassword) return;
    if (!currentPassword) { showSecurityStatus("Please enter your current password.", "error"); return; }
    if (!newPassword) { showSecurityStatus("Please enter a new password.", "error"); return; }
    if (currentPassword === newPassword) { showSecurityStatus("New password cannot be the same as the current password.", "error"); return; }
    const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!pwdRegex.test(newPassword)) { showSecurityStatus("New password must be at least 8 characters and contain an uppercase letter, a lowercase letter, and a number.", "error"); return; }

    setIsUpdatingSecurity(true);
    try {
      const token = localStorage.getItem('insightai_token');
      const res = await axios.put('http://localhost:8000/api/auth/update-password', {
        current_password: currentPassword,
        new_password: newPassword
      }, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.data.success) {
        setCurrentPassword('');
        setNewPassword('');
        setShowCurrentPass(false);
        setShowNewPass(false);
        showSecurityStatus("Password updated successfully.", "success");
      } else {
        showSecurityStatus(res.data.message || "Failed to update password.", "error");
      }
    } catch (err: any) {
      showSecurityStatus(err.response?.data?.message || "An error occurred while updating the password.", "error");
    }
    setIsUpdatingSecurity(false);
  };

  const handleSaveApiKey = () => {
    if (!customApiKey.trim()) {
      setApiKeyStatusMsg("Please enter an API key to save.");
      setApiKeyStatusType("error");
      setTimeout(() => setApiKeyStatusMsg(null), 4000);
      return;
    }
    localStorage.setItem("custom_openrouter_api_key", customApiKey);
    setApiKeyStatusMsg("API key saved successfully.");
    setApiKeyStatusType("success");
    setTimeout(() => setApiKeyStatusMsg(null), 4000);
  };

  const handleSchemaSearch = async (val: string) => {
    setSchemaSearchQuery(val);
    if (!val.trim()) {
      setSchemaSearchResults([]);
      return;
    }
    setIsSearchingSchemas(true);
    try {
      const token = localStorage.getItem('insightai_token');
      const res = await axios.post('http://localhost:8000/api/upload/search', {
        query: val
      }, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      setSchemaSearchResults(res.data || []);
    } catch (err) {
      console.error("Schema search failed", err);
    } finally {
      setIsSearchingSchemas(false);
    }
  };

  useEffect(() => {
    if (!user || activeNavTab !== 'dashboard') return;
    
    setDashboardLoading(true);
    axios.get('http://localhost:8000/api/dashboard/stats/')
    .then(res => {
      setDashboardData(res.data);
    })
    .catch(err => {
      console.error("Failed to load operational stats", err);
    })
    .finally(() => {
      setDashboardLoading(false);
    });
  }, [user, activeNavTab]);

  useEffect(() => {
    if (!user || activeNavTab !== 'settings' || !logsExpanded) return;

    const fetchLogs = () => {
      const token = localStorage.getItem('insightai_token');
      axios.get('http://localhost:8000/api/dashboard/logs/', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      .then(res => {
        setSystemLogs(res.data || []);
      })
      .catch(err => {
        console.error("Failed to fetch system logs", err);
      });
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [user, activeNavTab, logsExpanded]);

  const fetchEvalsReport = () => {
    const token = localStorage.getItem('insightai_token');
    axios.get('http://localhost:8000/api/dashboard/evals/', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    .then(res => {
      setEvalsReport(res.data);
    })
    .catch(err => {
      console.error("Failed to fetch evals report", err);
    });
  };

  useEffect(() => {
    if (!user || activeNavTab !== 'settings' || !evalsExpanded) return;
    fetchEvalsReport();
  }, [user, activeNavTab, evalsExpanded]);

  const handleRunEvals = () => {
    setEvalsLoading(true);
    const token = localStorage.getItem('insightai_token');
    axios.post('http://localhost:8000/api/dashboard/evals/run', {}, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
    .then(() => {
      let attempts = 0;
      const interval = setInterval(() => {
        axios.get('http://localhost:8000/api/dashboard/evals/', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
        .then(res => {
          attempts++;
          if (res.data.timestamp !== "Never executed" && res.data.metrics.total_tests > 0) {
            setEvalsReport(res.data);
            setEvalsLoading(false);
            clearInterval(interval);
          }
          if (attempts > 20) {
            setEvalsLoading(false);
            clearInterval(interval);
          }
        })
        .catch(() => {
          setEvalsLoading(false);
          clearInterval(interval);
        });
      }, 3000);
    })
    .catch(err => {
      console.error("Failed to run evals", err);
      setEvalsLoading(false);
    });
  };

  useEffect(() => {
    if (selectedDatasets.length === 0) {
      setQualityReport(null);
      setSelectedQualityFile(null);
      return;
    }
    if (!selectedQualityFile || !selectedDatasets.includes(selectedQualityFile)) {
      setSelectedQualityFile(selectedDatasets[0]);
    }
  }, [selectedDatasets, selectedQualityFile]);

  useEffect(() => {
    if (!user || activeNavTab !== 'quality' || !selectedQualityFile) return;

    setQualityLoading(true);
    axios.get(`http://localhost:8000/api/quality/${selectedQualityFile}`)
    .then(res => {
      setQualityReport(res.data);
    })
    .catch(err => {
      console.error("Failed to load quality report", err);
      setQualityReport(null);
    })
    .finally(() => {
      setQualityLoading(false);
    });
  }, [user, activeNavTab, selectedQualityFile]);

  const [selectedForecastFile, setSelectedForecastFile] = useState<string | null>(null);
  const [forecastDateCol, setForecastDateCol] = useState<string>('');
  const [forecastValCol, setForecastValCol] = useState<string>('');
  const [forecastHorizon, setForecastHorizon] = useState<number>(30);
  const [forecastMethod, setForecastMethod] = useState<string>('exponential');
  const [forecastResult, setForecastResult] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastCols, setForecastCols] = useState<any[]>([]);

  useEffect(() => {
    if (selectedDatasets.length === 0) {
      setSelectedForecastFile(null);
      setForecastCols([]);
      setForecastResult(null);
      return;
    }
    if (!selectedForecastFile || !selectedDatasets.includes(selectedForecastFile)) {
      setSelectedForecastFile(selectedDatasets[0]);
    }
  }, [selectedDatasets, selectedForecastFile]);

  useEffect(() => {
    if (!user || !selectedForecastFile) return;
    axios.get(`http://localhost:8000/api/quality/${selectedForecastFile}`)
    .then(res => {
      if (res.data && res.data.columns) {
        setForecastCols(res.data.columns);
        const dateColItem = res.data.columns.find((c: any) => c.type.includes('date') || c.name.toLowerCase().includes('date') || c.name.toLowerCase().includes('time') || c.name.toLowerCase().includes('year'));
        const numColItem = res.data.columns.find((c: any) => c.type.includes('int') || c.type.includes('float') || c.name.toLowerCase().includes('sales') || c.name.toLowerCase().includes('amount') || c.name.toLowerCase().includes('price'));
        
        setForecastDateCol(dateColItem ? dateColItem.name : res.data.columns[0]?.name || '');
        setForecastValCol(numColItem ? numColItem.name : res.data.columns[1]?.name || '');
      }
    })
    .catch(err => {
      console.error("Failed to load columns for forecast", err);
    });
  }, [user, selectedForecastFile]);

  const handleRunForecast = () => {
    if (!selectedForecastFile || !forecastDateCol || !forecastValCol) return;
    setForecastLoading(true);
    axios.post('http://localhost:8000/api/forecast/', {
      filename: selectedForecastFile,
      date_col: forecastDateCol,
      value_col: forecastValCol,
      horizon: Number(forecastHorizon),
      method: forecastMethod
    })
    .then(res => {
      setForecastResult(res.data);
    })
    .catch(err => {
      console.error("Forecasting failed", err);
      alert(err.response?.data?.detail || "Failed to execute forecast. Verify data format.");
    })
    .finally(() => {
      setForecastLoading(false);
    });
  };

  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
      : true,
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Restore datasets and sessions from API after login
  useEffect(() => {
    if (!user) return;
    axios.get('http://localhost:8000/api/upload/list')
      .then(res => {
        const names: string[] = res.data.map((d: any) => d.filename);
        setDatasets(names);
        if (names.length > 0 && selectedDatasets.length === 0) {
          setSelectedDatasets([names[0]]);
        }
      })
      .catch(() => {}); // silently ignore if endpoint fails

    axios.get('http://localhost:8000/api/sessions/')
      .then(res => {
        const loaded = res.data;
        setSessions(loaded);
        if (loaded.length > 0) {
          setActiveSessionKey(loaded[0].session_key);
        } else {
          createNewSession(undefined, []);
        }
      })
      .catch(() => {});
  }, [user]);

  const createNewSession = async (customName?: string, currentSessions: any[] = sessions) => {
    if (!user) return;
    const newKey = `session_${Math.random().toString(36).substr(2, 9)}`;
    const newName = customName || `Chat Session ${currentSessions.length + 1}`;
    try {
      const res = await axios.post('http://localhost:8000/api/sessions/', {
        session_key: newKey,
        session_name: newName,
        active_dataset: selectedDatasets.join(','),
        agent_mode: activeAgentMode,
      });
      setSessions(prev => [res.data, ...prev]);
      setActiveSessionKey(newKey);
    } catch (err) {
      console.error("Failed to create session", err);
    }
  };

  const deleteSession = async (sessionKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await axios.delete(`http://localhost:8000/api/sessions/${sessionKey}`);
      setSessions(prev => {
        const filtered = prev.filter(s => s.session_key !== sessionKey);
        if (activeSessionKey === sessionKey) {
          if (filtered.length > 0) {
            setActiveSessionKey(filtered[0].session_key);
            if (filtered[0].active_dataset) {
              const files = filtered[0].active_dataset.split(',').filter((f: string) => datasets.includes(f));
              setSelectedDatasets(files);
            }
          } else {
            setActiveSessionKey(null);
          }
        }
        return filtered;
      });
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  // Toggle dataset selection back and forth
  const handleSelectDataset = async (dataset: string) => {
    const updated = selectedDatasets.includes(dataset)
      ? selectedDatasets.filter(d => d !== dataset)
      : [...selectedDatasets, dataset];
      
    setSelectedDatasets(updated);
    
    if (activeSessionKey) {
      try {
        const res = await axios.post('http://localhost:8000/api/sessions/', {
          session_key: activeSessionKey,
          active_dataset: updated.join(','),
          agent_mode: activeAgentMode,
        });
        setSessions(prev => prev.map(s => s.session_key === activeSessionKey ? res.data : s));
      } catch (err) {
        console.error("Failed to update session datasets list", err);
      }
    }
  };

  // Sync active session's datasets on switch
  useEffect(() => {
    if (!activeSessionKey) return;
    const current = sessions.find(s => s.session_key === activeSessionKey);
    if (current) {
      if (current.active_dataset) {
        const files = current.active_dataset.split(',').filter((f: string) => datasets.includes(f));
        setSelectedDatasets(files);
      } else {
        setSelectedDatasets([]);
      }
      if (current.agent_mode) {
        setActiveAgentMode(current.agent_mode);
      }
    }
  }, [activeSessionKey, sessions, datasets]);

  const handleUploadSuccess = (filename: string) => {
    setDatasets(prev => prev.includes(filename) ? prev : [...prev, filename]);
    setSelectedDatasets(prev => prev.includes(filename) ? prev : [...prev, filename]);
    setActiveNavTab('chat');
  };

  const removeDataset = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDatasets(prev => prev.filter(d => d !== name));
    setSelectedDatasets(prev => prev.filter(d => d !== name));
  };

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'chat',      label: 'Chat',      icon: MessageSquare  },
    { id: 'quality',   label: 'Data Quality', icon: ShieldCheck },
    { id: 'forecast',  label: 'Forecasting',  icon: TrendingUp     },
    { id: 'upload',    label: 'Upload',    icon: UploadCloud    },
    { id: 'reports',   label: 'Reports',   icon: BarChart3      },
    { id: 'settings',  label: 'Settings',  icon: Settings       },
  ];

  const notifications = [
    { id: 1, title: 'Dataset Processed', desc: `${datasets[datasets.length-1] ?? 'Your file'} is ready`, time: 'Just now', read: false },
    { id: 2, title: 'Insight Generated', desc: 'New business insight available', time: '2m ago', read: false },
  ].filter(() => datasets.length > 0);

  const filteredDatasets = datasets.filter(d =>
    d.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabTitle: Record<string, string> = {
    dashboard: 'Dashboard', chat: 'AI Chat Analyst',
    quality: 'Data Quality Audit', forecast: 'Forecasting',
    upload: 'Upload Dataset', reports: 'Reports', settings: 'Settings',
  };

  // ── Auth guards ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
            <Zap size={20} className="text-white" />
          </div>
          <p className="text-sm text-slate-400 font-medium">Loading InsightAI...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  const userInitials = (user.display_name || user.email)
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden relative transition-colors duration-300">
      {/* ── Ambient glows (dark only) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/5 dark:bg-indigo-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-purple-600/5 dark:bg-purple-600/10 blur-[120px]" />
      </div>

      {/* ── Left Sidebar ── */}
      <aside className="w-60 border-r border-slate-200 dark:border-slate-900 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl flex flex-col justify-between py-5 px-3 z-20 flex-shrink-0 transition-colors duration-300">
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Zap size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none">InsightAI</h1>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Data Analyst</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-0.5">
            {navLinks.map(({ id, label, icon: Icon }) => {
              const active = activeNavTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveNavTab(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                  {active && <div className="ml-auto w-1.5 h-3 rounded-full bg-indigo-500" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer — user card + logout */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900/80 p-3 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{user.display_name || user.email.split('@')[0]}</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-semibold text-slate-500 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 border border-slate-200 dark:border-slate-800/60 transition-all cursor-pointer"
          >
            <LogOut size={11} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Panel ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden z-10">

        {/* ── Header ── */}
        <header className="px-5 py-3 border-b border-slate-200 dark:border-slate-900 flex items-center justify-between bg-white/80 dark:bg-slate-950/60 backdrop-blur-md flex-shrink-0 transition-colors duration-300">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{tabTitle[activeNavTab]}</h2>

          <div className="flex items-center gap-2.5">

            {/* ── Search ── */}
            <div ref={searchRef} className="relative">
              <button
                onClick={() => { setSearchOpen(s => !s); setSearchQuery(''); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-slate-700 transition-all duration-200 cursor-pointer"
              >
                <Search size={13} />
                <span className="text-[11px] hidden md:block">Search...</span>
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-700 bg-slate-200 dark:bg-slate-800/40 px-1.5 py-0.5 rounded hidden md:block">⌘K</span>
              </button>

              {searchOpen && (
                <div className="absolute top-10 right-0 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-black/20 z-50 overflow-hidden animate-scale-in">
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <Search size={13} className="text-slate-400" />
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search datasets..."
                      className="flex-1 text-xs bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
                    />
                    <button onClick={() => setSearchOpen(false)}><X size={13} className="text-slate-400 hover:text-slate-600 cursor-pointer" /></button>
                  </div>
                  <div className="max-h-52 overflow-y-auto custom-scrollbar py-1">
                    {filteredDatasets.length === 0 ? (
                      <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 py-6">
                        {searchQuery ? 'No matching datasets' : 'No datasets uploaded yet'}
                      </p>
                    ) : (
                      filteredDatasets.map((ds, i) => (
                        <button
                          key={i}
                          onClick={() => { handleSelectDataset(ds); setActiveNavTab('chat'); setSearchOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                        >
                          <FileSpreadsheet size={13} className="text-indigo-400 flex-shrink-0" />
                          <div>
                            <span className="block text-xs font-medium text-slate-700 dark:text-slate-200">{ds}</span>
                            <span className="text-[10px] text-slate-400">Click to analyse</span>
                          </div>
                          <ChevronRight size={12} className="ml-auto text-slate-300 dark:text-slate-600" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Notification Bell ── */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen(s => !s)}
                className="relative p-2 rounded-lg bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-slate-700 transition-all duration-200 cursor-pointer"
              >
                <Bell size={14} />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-950" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute top-11 right-0 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-black/20 z-50 overflow-hidden animate-scale-in">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Notifications</span>
                    {notifications.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-500/20">
                        {notifications.length} new
                      </span>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="py-10 flex flex-col items-center gap-2">
                      <Bell size={28} className="text-slate-200 dark:text-slate-700" />
                      <p className="text-xs text-slate-400 dark:text-slate-600 font-medium">No notifications yet</p>
                      <p className="text-[10px] text-slate-300 dark:text-slate-700">Upload a dataset to get started</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto custom-scrollbar">
                      {notifications.map(n => (
                        <div key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                            <CheckCircle size={13} className="text-indigo-500 dark:text-indigo-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{n.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{n.desc}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-600 flex-shrink-0">{n.time}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Dark / Light toggle ── */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-slate-700 transition-all duration-200 cursor-pointer"
            >
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* ── User Avatar with initials ── */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-indigo-500/20 cursor-pointer select-none" title={user.email}>
              {userInitials}
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="flex-1 overflow-hidden relative bg-slate-50/50 dark:bg-transparent">

          {/* ════════ TAB: DASHBOARD ════════ */}
          {activeNavTab === 'dashboard' && (
            <div className="h-full overflow-y-auto p-6 space-y-6 custom-scrollbar animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800/60 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Operations Activity Dashboard</h3>
                  <p className="text-xs text-slate-550 dark:text-slate-400">Real-time system telemetry, agent statistics, and interaction logs</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping flex-shrink-0" />
                  <span className="text-[10px] bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Live System Syncing</span>
                </div>
              </div>

              {/* Loader */}
              {dashboardLoading && (
                <div className="h-64 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold">Loading operations telemetry...</p>
                </div>
              )}

              {/* Stats & Charts Content */}
              {!dashboardLoading && dashboardData && (
                <div className="space-y-6 animate-fade-in">
                  {/* Summary Metric Cards (Vibrant gradients with glow effects) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Datasets Uploaded', value: dashboardData.summary.total_datasets, icon: Database, gradient: 'from-indigo-500 to-indigo-650 shadow-indigo-500/15' },
                      { label: 'Conversations Built', value: dashboardData.summary.total_sessions, icon: MessageSquare, gradient: 'from-cyan-500 to-cyan-650 shadow-cyan-500/15' },
                      { label: 'Queries Submitted', value: dashboardData.summary.total_user_messages, icon: Sparkles, gradient: 'from-rose-500 to-rose-650 shadow-rose-500/15' },
                      { label: 'AI Answers Provided', value: dashboardData.summary.total_ai_responses, icon: Lightbulb, gradient: 'from-emerald-500 to-emerald-650 shadow-emerald-500/15' },
                    ].map(({ label, value, icon: Icon, gradient }) => (
                      <div key={label} className={`p-4 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center gap-3.5 shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-default relative overflow-hidden group`}>
                        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10 group-hover:scale-110 transition-transform duration-300">
                          <Icon size={75} />
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white flex-shrink-0">
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="block text-base font-black tracking-tight">{value.toLocaleString()}</span>
                          <span className="block text-[8px] text-white/80 font-bold uppercase tracking-wider mt-0.5 truncate">{label}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Main Analysis Panels (Left: Charts, Right: Diagnostics & Metrics) */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Charts Grid - 2 cols span */}
                    <div className="lg:col-span-2 space-y-6">
                      {dashboardData.charts.map((c: any, idx: number) => (
                        <div key={idx} className="p-5 rounded-2xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/80 shadow-md flex flex-col gap-4">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/40 pb-3">
                            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-200">{c.title}</h5>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider">Metrics</span>
                          </div>
                          <div className="flex-1 min-h-[460px] relative">
                            <ChartViewer config={c.config} isDarkMode={isDarkMode} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Diagnostics & Agent Performance Table */}
                    <div className="space-y-6">
                      {/* Telemetry Diagnostics Card */}
                      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/80 shadow-md space-y-4">
                        <div className="border-b border-slate-100 dark:border-slate-800/40 pb-3">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Telemetry Health Logs</h4>
                        </div>
                        <div className="space-y-3">
                          {[
                            { label: 'Database Health', value: 'Connected', badge: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
                            { label: 'Model Latency Status', value: '0.8s Avg', badge: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' },
                            { label: 'Avg User Query Length', value: `${dashboardData.summary.avg_query_len} chars`, badge: 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' },
                            { label: 'Anomalies Highlighted', value: `${dashboardData.summary.anomalies_detected} flagged`, badge: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400' },
                          ].map((diag) => (
                            <div key={diag.label} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-900/50 last:border-0">
                              <span className="text-slate-450 dark:text-slate-500 font-semibold">{diag.label}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${diag.badge}`}>
                                {diag.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Agent usage metrics table */}
                      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/80 shadow-md space-y-4">
                        <div className="border-b border-slate-100 dark:border-slate-800/40 pb-3">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Agent Performance Table</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-100 dark:border-slate-800/50 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">
                                <th className="pb-2">AI Agent Mode</th>
                                <th className="pb-2 text-right">Queries</th>
                                <th className="pb-2 text-right">Avg Lgth</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-900/40">
                              {dashboardData.agent_metrics && dashboardData.agent_metrics.length > 0 ? (
                                dashboardData.agent_metrics.map((row: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors">
                                    <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">{row.agent}</td>
                                    <td className="py-2.5 text-right font-black text-indigo-500 dark:text-indigo-400">{row.queries}</td>
                                    <td className="py-2.5 text-right text-slate-500 dark:text-slate-500">{row.avg_length} chars</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={3} className="py-4 text-center text-slate-400 dark:text-slate-600">No agent requests logged.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Timeline Logs */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/80 space-y-4">
                    <div className="border-b border-slate-100 dark:border-slate-800/40 pb-3 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Operational Log Feed</h4>
                      <span className="text-[9px] text-slate-400 font-semibold">Last 10 user queries</span>
                    </div>

                    {dashboardData.recent_operations && dashboardData.recent_operations.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/40 max-h-96 overflow-y-auto custom-scrollbar">
                        {dashboardData.recent_operations.map((op: any, i: number) => (
                          <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs hover:bg-slate-50/20 dark:hover:bg-slate-950/5 px-2 rounded-xl transition-colors">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/10">
                                  {op.agent_mode}
                                </span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                                  {op.session_name}
                                </span>
                              </div>
                              <p className="text-slate-550 dark:text-slate-450 italic truncate text-[11px] px-0.5">
                                "{op.text}"
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-400 dark:text-slate-600 font-medium">
                              {op.timestamp}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-650 text-center py-4">No operations executed in this account yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════ TAB: UPLOAD ════════ */}
          {activeNavTab === 'upload' && (
            <div className="h-full overflow-y-auto custom-scrollbar animate-fade-in">
              <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
                {/* Heading */}
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center mx-auto animate-float">
                    <UploadCloud size={28} className="text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Upload Your Dataset</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Drop a CSV file below to start analysing your data with our AI-powered agents.
                  </p>
                </div>

                {/* Upload Drop Zone (full-size beautiful card) */}
                <Upload onUploadSuccess={handleUploadSuccess} />

                {/* Feature highlights */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Auto Schema', desc: 'Detects column types instantly' },
                    { label: 'AI Analysis', desc: 'Powered by LLM insights' },
                    { label: 'Secure', desc: 'Local processing only' },
                  ].map(({ label, desc }) => (
                    <div key={label} className="p-3 rounded-xl bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 text-center">
                      <CheckCircle size={14} className="text-emerald-500 mx-auto mb-1.5" />
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{label}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>

                {/* Already uploaded files */}
                {datasets.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Already Uploaded</h4>
                    <div className="space-y-2">
                      {datasets.map((ds, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/60 hover:border-indigo-200 dark:hover:border-indigo-500/20 transition-colors group">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                            <FileSpreadsheet size={13} className="text-indigo-500 dark:text-indigo-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{ds}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">Ready to analyse</span>
                          </div>
                          <button
                            onClick={() => { handleSelectDataset(ds); setActiveNavTab('chat'); }}
                            className="text-[10px] px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          >
                            Analyse →
                          </button>
                          <button
                            onClick={e => removeDataset(ds, e)}
                            className="p-1 rounded text-slate-400 hover:text-red-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════ TAB: CHAT ════════ */}
          {activeNavTab === 'chat' && (
            <div className="h-full flex overflow-hidden animate-fade-in bg-transparent">

              {/* Dataset Sub-sidebar */}
              <aside className="w-60 border-r border-slate-200 dark:border-slate-900 bg-white/80 dark:bg-slate-950/40 flex flex-col overflow-hidden p-4 flex-shrink-0 transition-colors duration-300">
                {/* Chat Sessions Card */}
                <div className="mb-4 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare size={11} className="text-indigo-500 dark:text-indigo-400" />
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Chat Sessions</span>
                    </div>
                    <button
                      onClick={() => createNewSession()}
                      className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/40 dark:border-indigo-500/30 transition-all font-bold cursor-pointer"
                    >
                      + New
                    </button>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 overflow-hidden max-h-36 overflow-y-auto custom-scrollbar">
                    {sessions.length === 0 ? (
                      <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 py-3">No sessions active</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {sessions.map((s) => {
                          const active = activeSessionKey === s.session_key;
                          return (
                            <li
                              key={s.session_key}
                              onClick={() => setActiveSessionKey(s.session_key)}
                              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                active
                                  ? 'bg-indigo-50 dark:bg-indigo-500/10'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/30'
                              }`}
                            >
                              <MessageSquare size={11} className={active ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'} />
                              <span className={`text-[11px] truncate font-medium flex-1 ${active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>
                                {s.session_name}
                              </span>
                              <button
                                onClick={(e) => deleteSession(s.session_key, e)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all cursor-pointer"
                              >
                                <Trash2 size={10} />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Card 0 — Schema Search */}
                <div className="mb-4 flex-shrink-0">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Search size={11} className="text-indigo-500 dark:text-indigo-400" />
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Search Schema Fields</span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search columns (e.g. profit, sales)..."
                      value={schemaSearchQuery}
                      onChange={(e) => handleSchemaSearch(e.target.value)}
                      className="w-full text-[11px] pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 focus:outline-none focus:border-indigo-500 text-slate-700 dark:text-slate-350 placeholder-slate-400 dark:placeholder-slate-650"
                    />
                    <Search size={12} className="absolute left-2.5 top-3 text-slate-400 dark:text-slate-600" />
                    {isSearchingSchemas && (
                      <div className="absolute right-2.5 top-3 w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  
                  {schemaSearchResults.length > 0 && (
                    <div className="mt-2 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-850 p-2 shadow-lg max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 z-50 relative">
                      {schemaSearchResults.map((match, i) => (
                        <div key={i} className="text-[10px] p-2 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900 flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{match.column}</span>
                            <span className="text-[9px] text-slate-400 font-mono px-1 py-0.5 rounded bg-slate-200/50 dark:bg-slate-800/60">{match.type}</span>
                          </div>
                          <div className="text-[9px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-1">
                            <span className="truncate max-w-[110px] font-medium text-slate-500 dark:text-slate-400" title={match.filename}>{match.filename}</span>
                            <span className="text-emerald-500 font-semibold">{Math.round(match.score * 100)}% Match</span>
                          </div>
                          {match.sample.length > 0 && (
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <span className="text-[8px] text-slate-400 uppercase tracking-wide">Sample:</span>
                              {match.sample.map((val: string, vi: number) => (
                                <span key={vi} className="text-[8px] px-1 py-0.5 rounded bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-500/10 truncate max-w-[50px]">{val}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card 1 — Available Files */}
                <div className="mb-3 flex-shrink-0">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Folder size={11} className="text-slate-400 dark:text-slate-500" />
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Available Files</span>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 overflow-hidden">
                    {datasets.length === 0 ? (
                      <div className="p-4 flex flex-col items-center gap-1.5 text-center">
                        <FileSpreadsheet size={18} className="text-slate-300 dark:text-slate-700" />
                        <p className="text-[10px] text-slate-400 dark:text-slate-600">No files uploaded yet</p>
                        <button
                          onClick={() => setActiveNavTab('upload')}
                          className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold hover:underline cursor-pointer mt-0.5"
                        >
                          Upload a file →
                        </button>
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {datasets.map((ds, i) => {
                          const selected = selectedDatasets.includes(ds);
                          return (
                            <li
                              key={i}
                              onClick={() => handleSelectDataset(ds)}
                              className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                                selected
                                  ? 'bg-indigo-50 dark:bg-indigo-500/10'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/30'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => {}} // handled by click on li
                                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-800 text-indigo-650 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                              />
                              <span className={`text-[11px] truncate font-medium flex-1 ${selected ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>
                                {ds}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Card 2 — Selected Files */}
                <div className="flex-shrink-0">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles size={11} className="text-indigo-400" />
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Selected Files</span>
                  </div>
                  <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-500/20 p-3 max-h-48 overflow-y-auto custom-scrollbar">
                    {selectedDatasets.length > 0 ? (
                      <div className="space-y-2.5">
                        <div className="space-y-1.5">
                          {selectedDatasets.map((ds, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                <FileSpreadsheet size={10} className="text-indigo-500 dark:text-indigo-400" />
                              </div>
                              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 truncate flex-1">{ds}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-1 pt-1.5 border-t border-indigo-100 dark:border-indigo-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[9px] text-emerald-500 dark:text-emerald-400 font-semibold">{selectedDatasets.length} files ready to query</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 py-2 text-center">
                        <Sparkles size={14} className="text-indigo-300 dark:text-indigo-700" />
                        <p className="text-[10px] text-slate-400 dark:text-slate-650">No files selected</p>
                        <p className="text-[9px] text-slate-305 dark:text-slate-600">Select files from list to analyze</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Remove dataset controls */}
                {datasets.length > 0 && (
                  <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-900">
                    <p className="text-[9px] font-semibold text-slate-300 dark:text-slate-700 uppercase tracking-wider mb-1.5">Manage</p>
                    <ul className="space-y-0.5">
                      {datasets.map((ds, i) => (
                        <li key={i} className="flex items-center gap-2 px-1 py-1 group rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900/40 transition-colors">
                          <span className="text-[10px] text-slate-500 dark:text-slate-500 truncate flex-1">{ds}</span>
                          <button
                            onClick={e => removeDataset(ds, e)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                          >
                            <Trash2 size={10} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>

              {/* Chat Window */}
              <section className="flex-1 overflow-hidden flex flex-col min-w-0 bg-transparent relative">
                <ChatWindow
                  sessionId={activeSessionKey || ''}
                  activeDatasets={selectedDatasets}
                  isDarkMode={isDarkMode}
                  agentMode={activeAgentMode}
                  setAgentMode={setActiveAgentMode}
                />
              </section>
            </div>
          )}

          {/* ════════ TAB: DATA QUALITY ════════ */}
          {activeNavTab === 'quality' && (
            <div className="h-full overflow-y-auto p-6 space-y-6 custom-scrollbar animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800/60 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Data Quality Audit</h3>
                  <p className="text-xs text-slate-550 dark:text-slate-400">Automated profiling, health score indicators, and completeness reviews</p>
                </div>
                
                {selectedDatasets.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-150 dark:border-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                      <ShieldCheck size={11} />
                      Audited & Secured
                    </div>
                    <select
                      value={selectedQualityFile || ''}
                      onChange={e => setSelectedQualityFile(e.target.value)}
                      className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none shadow-sm"
                    >
                      {selectedDatasets.map(ds => (
                        <option key={ds} value={ds}>{ds}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {selectedDatasets.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-2xl">
                  Check files on the left sidebar to analyze their data quality.
                </div>
              ) : qualityLoading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold">Running data quality assertions...</p>
                </div>
              ) : qualityReport ? (
                <div className="space-y-6 animate-fade-in">
                  {/* Gauge Card & Overview Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Score Card with Glow Background */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/80 shadow-md flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Overall Health Score</h4>
                      
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        {/* Glow filter under circle path */}
                        <div className={`absolute w-24 h-24 rounded-full blur-xl opacity-20 ${
                          qualityReport.health_score >= 90 ? 'bg-emerald-500' :
                          qualityReport.health_score >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                        }`} />
                        <svg className="w-full h-full transform -rotate-90 relative z-10" viewBox="0 0 36 36">
                          <circle
                            className="text-slate-100 dark:text-slate-800/80"
                            strokeWidth="3.2"
                            stroke="currentColor"
                            fill="transparent"
                            r="15.9155"
                            cx="18"
                            cy="18"
                          />
                          <circle
                            className={`transition-all duration-1000 ease-out ${
                              qualityReport.health_score >= 90 ? 'text-emerald-500' :
                              qualityReport.health_score >= 70 ? 'text-amber-500' : 'text-rose-500'
                            }`}
                            strokeDasharray={`${qualityReport.health_score}, 100`}
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="15.9155"
                            cx="18"
                            cy="18"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center z-10">
                          <span className="text-2xl font-black text-slate-850 dark:text-slate-50 tracking-tighter">{qualityReport.health_score}%</span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Grade</span>
                        </div>
                      </div>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        qualityReport.health_score >= 90 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        qualityReport.health_score >= 70 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {qualityReport.health_score >= 90 ? 'Optimal Integrity' :
                         qualityReport.health_score >= 70 ? 'Minor Warnings' : 'Action Required'}
                      </span>
                    </div>

                    {/* Structural Diagnostics Grid */}
                    <div className="md:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/80 shadow-md flex flex-col justify-between gap-4">
                      <div className="border-b border-slate-100 dark:border-slate-800/40 pb-2">
                        <h4 className="text-xs font-bold text-slate-850 dark:text-slate-100">Dataset Diagnostics Profile</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: 'Total Rows', value: qualityReport.summary.total_rows.toLocaleString(), icon: Database, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' },
                          { label: 'Feature Columns', value: qualityReport.summary.total_cols, icon: FileSpreadsheet, color: 'text-cyan-500 bg-cyan-500/10' },
                          { label: 'Duplicated Rows', value: `${qualityReport.summary.duplicate_rows} (${qualityReport.summary.duplicate_percentage}%)`, icon: Trash2, color: 'text-rose-500 bg-rose-500/10' },
                          { label: 'Empty Cells Rate', value: `${qualityReport.summary.missing_cells_percentage}%`, icon: Sparkles, color: 'text-amber-500 bg-amber-500/10' },
                        ].map((m) => {
                          const Icon = m.icon;
                          return (
                            <div key={m.label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850/60 flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${m.color} flex items-center justify-center flex-shrink-0`}>
                                <Icon size={14} />
                              </div>
                              <div>
                                <span className="block text-xs font-black text-slate-850 dark:text-slate-100">{m.value}</span>
                                <span className="block text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">{m.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="flex items-center gap-2 text-[10px] text-slate-450 dark:text-slate-500">
                        <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                        <span>Identified a total of <strong className="text-indigo-500 font-bold">{qualityReport.warnings_count}</strong> data anomalies across fields.</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Actionable Cleaning Advice */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-500/5 via-indigo-500/10 to-purple-500/5 dark:from-indigo-500/5 dark:to-purple-500/5 border border-indigo-150 dark:border-indigo-500/25 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-indigo-500 animate-pulse" />
                      AI Dataset Cleaning Suggestions
                    </h4>
                    <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed pl-1">
                      {qualityReport.summary.duplicate_rows > 0 && (
                        <li className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                          <span>We detected <strong>{qualityReport.summary.duplicate_rows} duplicate rows</strong>. Consider dropping them via chat prompts: <code className="px-1.5 py-0.5 rounded bg-slate-150 dark:bg-slate-900 font-mono text-[10px]">"remove duplicate entries"</code>.</span>
                        </li>
                      )}
                      {qualityReport.summary.missing_cells_percentage > 0 && (
                        <li className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                          <span>Some cells contain <strong>null values ({qualityReport.summary.missing_cells_percentage}%)</strong>. Try asking the analyst: <code className="px-1.5 py-0.5 rounded bg-slate-150 dark:bg-slate-900 font-mono text-[10px]">"impute missing values with average"</code>.</span>
                        </li>
                      )}
                      {qualityReport.outliers && qualityReport.outliers.length > 0 && (
                        <li className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                          <span>Outliers detected in numeric columns. Ask the AI: <code className="px-1.5 py-0.5 rounded bg-slate-150 dark:bg-slate-900 font-mono text-[10px]">"show outlier distribution and clip outliers"</code>.</span>
                        </li>
                      )}
                      {qualityReport.summary.duplicate_rows === 0 && qualityReport.summary.missing_cells_percentage === 0 && (
                        <li className="flex items-start gap-2 text-emerald-500 font-semibold">
                          <CheckCircle size={13} className="flex-shrink-0 mt-0.5" />
                          <span>This dataset has optimal structural integrity with zero duplication or null value concerns. No actions needed.</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Column Quality Audit Table */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/80 shadow-md space-y-4">
                    <div className="border-b border-slate-100 dark:border-slate-800/40 pb-3">
                      <h4 className="text-xs font-bold text-slate-855 dark:text-slate-100">Column Completeness & Integrity Matrix</h4>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800/50 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">
                            <th className="pb-2.5">Column Name</th>
                            <th className="pb-2.5">Data Type</th>
                            <th className="pb-2.5 text-center">Unique Keys</th>
                            <th className="pb-2.5 text-right pr-4">Completeness</th>
                            <th className="pb-2.5 pl-6">Quality Warnings</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-900/30">
                          {qualityReport.columns.map((c: any, i: number) => {
                            const completeness = Math.round(100 - c.null_percentage);
                            // Custom color badges based on types
                            let typeStyle = 'text-slate-500 bg-slate-100 dark:bg-slate-800';
                            if (c.type.includes('int')) typeStyle = 'text-violet-500 bg-violet-500/10 border border-violet-500/20';
                            else if (c.type.includes('float')) typeStyle = 'text-cyan-500 bg-cyan-500/10 border border-cyan-500/20';
                            else if (c.type.includes('object')) typeStyle = 'text-amber-500 bg-amber-500/10 border border-amber-500/20';
                            else if (c.type.includes('bool')) typeStyle = 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20';

                            return (
                              <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors">
                                <td className="py-3 font-bold text-slate-700 dark:text-slate-200">{c.name}</td>
                                <td className="py-3">
                                  <span className={`font-mono text-[9px] px-2 py-0.5 rounded font-bold ${typeStyle}`}>
                                    {c.type}
                                  </span>
                                </td>
                                <td className="py-3 text-center font-bold text-slate-600 dark:text-slate-350">{c.unique_count}</td>
                                <td className="py-3 text-right pr-4">
                                  <div className="flex items-center justify-end gap-2.5">
                                    <span className="font-black text-slate-750 dark:text-slate-250">{completeness}%</span>
                                    <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                                      <div
                                        className={`h-full rounded-full ${
                                          completeness >= 95 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                                          completeness >= 70 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                                          'bg-gradient-to-r from-rose-400 to-rose-500'
                                        }`}
                                        style={{ width: `${completeness}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 pl-6">
                                  {c.warnings && c.warnings.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {c.warnings.map((w: string, wIdx: number) => (
                                        <span key={wIdx} className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10">
                                          <AlertTriangle size={8} />
                                          {w}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[9px] font-bold text-emerald-500 dark:text-emerald-450 uppercase tracking-wider flex items-center gap-1">
                                      <CheckCircle size={10} /> Perfect Health
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Outlier Diagnostics Panel */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/80 shadow-md space-y-4">
                    <div className="border-b border-slate-100 dark:border-slate-800/40 pb-3 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Statistical Outlier Diagnostics (IQR Method)</h4>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Outliers Boundary Thresholds</span>
                    </div>

                    {qualityReport.outliers && qualityReport.outliers.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {qualityReport.outliers.map((o: any, i: number) => (
                          <div key={i} className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-950/10 border border-slate-200/60 dark:border-slate-900/80 flex flex-col gap-2 shadow-sm hover:scale-[1.01] transition-transform">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate max-w-[65%]">{o.column}</span>
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10 whitespace-nowrap">
                                {o.count} outliers ({o.percentage}%)
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-900 text-[10px] text-slate-450 dark:text-slate-500 font-medium">
                              <div>
                                <span className="block text-[8px] text-slate-400 font-bold uppercase">Lower bound</span>
                                <strong className="font-mono text-slate-700 dark:text-slate-350">{o.lower_bound}</strong>
                              </div>
                              <div>
                                <span className="block text-[8px] text-slate-400 font-bold uppercase">Upper bound</span>
                                <strong className="font-mono text-slate-700 dark:text-slate-350">{o.upper_bound}</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-650 text-center py-4">No significant numeric outliers detected in active columns.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-450 text-center py-4">Failed to compile quality assertions.</p>
              )}
            </div>
          )}

          {/* ════════ TAB: FORECASTING ════════ */}
          {activeNavTab === 'forecast' && (
            <div className="h-full overflow-y-auto p-6 space-y-6 custom-scrollbar animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800/60 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Predictive Analytics Forecast</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Project numerical key metrics into future horizons using statistical trend smoothing</p>
                </div>
                
                {selectedDatasets.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-450 dark:text-slate-500 font-semibold">Active dataset:</span>
                    <select
                      value={selectedForecastFile || ''}
                      onChange={e => {
                        setSelectedForecastFile(e.target.value);
                        setForecastResult(null);
                      }}
                      className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 font-bold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none shadow-sm"
                    >
                      {selectedDatasets.map(ds => (
                        <option key={ds} value={ds}>{ds}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {selectedDatasets.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-2xl">
                  Check files on the left sidebar to execute forecasting.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                  {/* Left Sidebar Controls */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/80 shadow-md space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/50 pb-2">Forecast Controls</h4>
                    
                    {/* Date Column */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date/Time Column</label>
                      <select
                        value={forecastDateCol}
                        onChange={e => setForecastDateCol(e.target.value)}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium text-slate-700 dark:text-slate-350 cursor-pointer focus:outline-none"
                      >
                        <option value="">Select Column</option>
                        {forecastCols.map((c: any) => (
                          <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                        ))}
                      </select>
                    </div>

                    {/* Value Column */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Target Numeric Column</label>
                      <select
                        value={forecastValCol}
                        onChange={e => setForecastValCol(e.target.value)}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium text-slate-700 dark:text-slate-350 cursor-pointer focus:outline-none"
                      >
                        <option value="">Select Column</option>
                        {forecastCols.filter(c => c.type.includes('int') || c.type.includes('float') || c.type.includes('double') || c.name.toLowerCase().includes('sales') || c.name.toLowerCase().includes('amount') || c.name.toLowerCase().includes('price')).map((c: any) => (
                          <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                        ))}
                      </select>
                    </div>

                    {/* Horizon */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Horizon (Future Steps)</label>
                      <select
                        value={forecastHorizon}
                        onChange={e => setForecastHorizon(Number(e.target.value))}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium text-slate-700 dark:text-slate-350 cursor-pointer focus:outline-none"
                      >
                        <option value={7}>7 steps forward</option>
                        <option value={14}>14 steps forward</option>
                        <option value={30}>30 steps forward</option>
                        <option value={60}>60 steps forward</option>
                        <option value={90}>90 steps forward</option>
                      </select>
                    </div>

                    {/* Method */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Smoothing Method</label>
                      <select
                        value={forecastMethod}
                        onChange={e => setForecastMethod(e.target.value)}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium text-slate-700 dark:text-slate-350 cursor-pointer focus:outline-none"
                      >
                        <option value="exponential">Exponential Smoothing (SES)</option>
                        <option value="linear">Linear Trend Projection</option>
                        <option value="moving_average">Moving Average Window</option>
                      </select>
                    </div>

                    <button
                      onClick={handleRunForecast}
                      disabled={forecastLoading || !forecastDateCol || !forecastValCol}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-250 dark:disabled:bg-slate-800/80 text-white font-semibold rounded-xl text-xs transition-colors shadow-md shadow-indigo-500/10 cursor-pointer disabled:cursor-not-allowed mt-2"
                    >
                      {forecastLoading ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <TrendingUp size={14} />
                      )}
                      <span>Run Forecast</span>
                    </button>
                  </div>

                  {/* Right Results Pane */}
                  <div className="lg:col-span-3 space-y-6">
                    {forecastLoading ? (
                      <div className="h-64 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-sm">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs text-slate-400 dark:text-slate-555 font-semibold">Running statistical simulations...</p>
                      </div>
                    ) : forecastResult ? (
                      <div className="space-y-6 animate-fade-in">
                        {/* Forecast summary KPIs */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 flex flex-col gap-1 shadow-sm">
                            <span className="text-[9px] text-slate-405 font-bold uppercase tracking-wider">Projected Growth</span>
                            <span className={`text-base font-black ${
                              forecastResult.summary.growth_percentage > 0 ? 'text-emerald-500' :
                              forecastResult.summary.growth_percentage < 0 ? 'text-rose-500' : 'text-slate-705'
                            }`}>
                              {forecastResult.summary.growth_percentage > 0 ? '+' : ''}
                              {forecastResult.summary.growth_percentage}%
                            </span>
                          </div>
                          
                          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 flex flex-col gap-1 shadow-sm">
                            <span className="text-[9px] text-slate-405 font-bold uppercase tracking-wider">Trend Direction</span>
                            <span className="text-base font-black text-slate-800 dark:text-slate-100">{forecastResult.summary.direction}</span>
                          </div>

                          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 flex flex-col gap-1 shadow-sm">
                            <span className="text-[9px] text-slate-405 font-bold uppercase tracking-wider">Mean Prediction</span>
                            <span className="text-base font-black text-indigo-500 dark:text-indigo-400">{forecastResult.summary.average_forecast}</span>
                          </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/80 shadow-md">
                          <div className="min-h-[460px] relative">
                            <ChartViewer config={forecastResult.chart_config} isDarkMode={isDarkMode} />
                          </div>
                        </div>

                        {/* Projection Details list */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/80 shadow-md space-y-3">
                          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/40 pb-2">Projections Data Table</h5>
                          <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800/50 text-[10px] text-slate-400 dark:text-slate-550 uppercase tracking-wider font-bold">
                                  <th className="pb-2">Date Step</th>
                                  <th className="pb-2 text-right">Predicted Value</th>
                                  <th className="pb-2 text-right pr-6">95% Confidence Bounds</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50 dark:divide-slate-900/30">
                                {forecastResult.projections.map((p: any, i: number) => (
                                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors">
                                    <td className="py-2.5 font-bold text-slate-650 dark:text-slate-350">{p.date}</td>
                                    <td className="py-2.5 text-right font-black text-emerald-500 dark:text-emerald-400">{p.prediction}</td>
                                    <td className="py-2.5 text-right pr-6 font-mono text-[10px] text-slate-400 dark:text-slate-500">{p.range}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-slate-400 dark:text-slate-555 bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-sm">
                        Select date and target columns on the left and click "Run Forecast".
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════ TAB: REPORTS ════════ */}
          {activeNavTab === 'reports' && (
            <ReportsTab sessions={sessions} datasets={datasets} />
          )}

          {/* ════════ TAB: SETTINGS ════════ */}
          {activeNavTab === 'settings' && (
            <div className="h-full overflow-y-auto px-6 lg:px-10 py-8 space-y-8 w-full custom-scrollbar animate-fade-in">
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Settings</h3>
                <p className="text-sm font-light text-slate-500 dark:text-slate-400">Manage your account, preferences, and platform configuration.</p>
              </div>
              <div className="space-y-4 w-full">
                {[
                  { icon: User,        label: 'Profile',        desc: 'Manage account details and preferences', action: () => setProfileExpanded(prev => !prev) },
                  { icon: Activity,    label: 'System Logs & Observability', desc: 'View live agent execution logs and metrics', action: () => setLogsExpanded(prev => !prev) },
                  { icon: Award,       label: 'Model Evaluation & Evals Suite', desc: 'Run automated validations and view agent performance', action: () => setEvalsExpanded(prev => !prev) },
                  { icon: Bell,        label: 'Notifications',  desc: 'Configure alert preferences', action: () => setNotificationsExpanded(prev => !prev) },
                  { icon: Shield,      label: 'Security',       desc: 'Password, 2FA, and API keys', action: () => setSecurityExpanded(prev => !prev) },
                  { icon: Sparkles,    label: 'Appearance',     desc: 'Theme, font size, and layout', action: () => setAppearanceExpanded(prev => !prev) },
                  { icon: StorageIcon, label: 'Data & Storage', desc: 'Storage usage and data retention', action: () => setStorageExpanded(prev => !prev) },
                ].map(({ icon: Icon, label, desc, action }) => (
                  <div key={label} className="flex flex-col space-y-3 w-full">
                    <div
                      onClick={action}
                      className="w-full p-4 lg:p-5 rounded-2xl bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-indigo-500/10 flex items-center justify-between cursor-pointer transition-all duration-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/40 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
                          <Icon size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</h4>
                          <p className="text-xs font-light text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className={`text-slate-400 dark:text-slate-500 shrink-0 transition-transform ${
                        (label === 'Profile' && profileExpanded) || 
                        (label === 'System Logs & Observability' && logsExpanded) ||
                        (label === 'Model Evaluation & Evals Suite' && evalsExpanded)
                          ? 'rotate-90'
                          : ''
                      }`} />
                    </div>
                    
                    {label === 'System Logs & Observability' && logsExpanded && (
                      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-[10px] leading-relaxed text-slate-350 shadow-inner animate-fade-in relative overflow-hidden">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                          <span>Live Agent Execution Stream</span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active Polling
                          </span>
                        </div>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1.5 pr-2">
                          {systemLogs.length === 0 ? (
                            <p className="text-slate-600 text-center py-6">No logs generated yet. Run a chat query to trace execution.</p>
                          ) : (
                            systemLogs.map((log, li) => {
                              let colorClass = "text-slate-400";
                              if (log.includes("[Agent: Supervisor]")) colorClass = "text-indigo-400";
                              else if (log.includes("[Agent: SQL Agent]")) colorClass = "text-emerald-400";
                              else if (log.includes("[Agent: Pandas Agent]")) colorClass = "text-blue-400";
                              else if (log.includes("[Agent: Anomaly Agent]")) colorClass = "text-rose-400";
                              else if (log.includes("[Agent: Insight Agent]")) colorClass = "text-amber-400";
                              else if (log.includes("[Agent: Planner]")) colorClass = "text-purple-400";
                              
                              return (
                                <div key={li} className={`break-words ${colorClass}`}>
                                  {log}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {label === 'Model Evaluation & Evals Suite' && evalsExpanded && (
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-800 space-y-5 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                          <div>
                            <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 font-bold">Model Evaluation Report</span>
                            <span className="block text-[9px] text-slate-400 dark:text-slate-550 font-medium">Last Run: {evalsReport?.timestamp || "Never executed"}</span>
                          </div>
                          <button
                            onClick={handleRunEvals}
                            disabled={evalsLoading}
                            className="flex items-center gap-1.5 py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white font-semibold rounded-lg text-[10px] transition-colors cursor-pointer disabled:cursor-not-allowed"
                          >
                            {evalsLoading ? (
                              <>
                                <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                                <span>Running Evals...</span>
                              </>
                            ) : (
                              <span>Run Evaluation Suite</span>
                            )}
                          </button>
                        </div>

                        {evalsReport && evalsReport.metrics.total_tests > 0 ? (
                          <div className="space-y-4">
                            {/* KPI Grid */}
                            <div className="grid grid-cols-3 gap-4">
                              <div className="p-3 bg-white dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-xl text-center shadow-sm">
                                <span className="block text-sm font-black text-indigo-500 dark:text-indigo-400">{evalsReport.metrics.pass_rate}%</span>
                                <span className="block text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Overall Pass Rate</span>
                              </div>
                              <div className="p-3 bg-white dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-xl text-center shadow-sm">
                                <span className="block text-sm font-black text-emerald-500 dark:text-emerald-400">{evalsReport.metrics.passed_tests} / {evalsReport.metrics.total_tests}</span>
                                <span className="block text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Tests Passed</span>
                              </div>
                              <div className="p-3 bg-white dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 rounded-xl text-center shadow-sm">
                                <span className="block text-sm font-black text-amber-500 dark:text-amber-400">{evalsReport.metrics.avg_latency}s</span>
                                <span className="block text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Avg Query Latency</span>
                              </div>
                            </div>

                            {/* Detailed Test Grid */}
                            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-850/80">
                              <table className="w-full text-left text-[10px] border-collapse bg-white dark:bg-slate-950/10">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[8px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider bg-slate-50 dark:bg-slate-950/40">
                                    <th className="px-4 py-2.5">ID</th>
                                    <th className="px-4 py-2.5">Test Case Name</th>
                                    <th className="px-4 py-2.5">Target Agent</th>
                                    <th className="px-4 py-2.5 text-center">SQL Status</th>
                                    <th className="px-4 py-2.5 text-center">Code Status</th>
                                    <th className="px-4 py-2.5 text-center">Assertion</th>
                                    <th className="px-4 py-2.5 text-right pr-4">Latency</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                                  {evalsReport.test_cases.map((tc: any, tci: number) => (
                                    <tr key={tci} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                                      <td className="px-4 py-3 font-mono font-bold text-slate-400">{tc.id}</td>
                                      <td className="px-4 py-3">
                                        <span className="block font-bold text-slate-700 dark:text-slate-250">{tc.name}</span>
                                        <span className="block text-[8px] text-slate-400 dark:text-slate-500 font-medium italic mt-0.5">"{tc.query}"</span>
                                      </td>
                                      <td className="px-4 py-3 font-mono text-[8px] text-indigo-500 dark:text-indigo-400 uppercase font-bold">{tc.agent_mode}</td>
                                      <td className="px-4 py-3 text-center">
                                        <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[8px] ${
                                          tc.sql_status === 'Passed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                          tc.sql_status === 'Failed' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400' :
                                          'bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-550'
                                        }`}>{tc.sql_status}</span>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <span className={`inline-block px-1.5 py-0.5 rounded font-bold text-[8px] ${
                                          tc.code_status === 'Passed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' :
                                          tc.code_status === 'Failed' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400' :
                                          'bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-550'
                                        }`}>{tc.code_status}</span>
                                      </td>
                                      <td className="px-4 py-3 text-center font-bold">
                                        <span className={`inline-block px-2 py-0.5 rounded-full ${
                                          tc.assertion_status === 'Passed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                        }`}>{tc.assertion_status}</span>
                                      </td>
                                      <td className="px-4 py-3 text-right pr-4 font-mono font-bold text-slate-650 dark:text-slate-350">{tc.latency_seconds}s</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : (
                          <div className="py-10 text-center text-slate-400 dark:text-slate-500">
                            No evaluations run yet. Click "Run Evaluation Suite" to benchmark agent execution.
                          </div>
                        )}
                      </div>
                    )}
                    
                    {label === 'Notifications' && notificationsExpanded && (
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-800 space-y-4 animate-fade-in text-slate-700 dark:text-slate-350">
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={notifEmail}
                              onChange={e => setNotifEmail(e.target.checked)}
                              className="rounded border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <div>
                              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">Email Reports</span>
                              <span className="block text-[8px] text-slate-400 dark:text-slate-500 mt-0.5">Send a consolidated analysis summary when datasets are processed.</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={notifSound}
                              onChange={e => setNotifSound(e.target.checked)}
                              className="rounded border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <div>
                              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">Cache Audio Alerts</span>
                              <span className="block text-[8px] text-slate-400 dark:text-slate-500 mt-0.5">Play a notification chime when a query hits the semantic cache.</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={notifAlert}
                              onChange={e => setNotifAlert(e.target.checked)}
                              className="rounded border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <div>
                              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">Live Agent Notifications</span>
                              <span className="block text-[8px] text-slate-400 dark:text-slate-500 mt-0.5">Display push notices when long time-series or multi-agent tasks compile.</span>
                            </div>
                          </label>
                        </div>
                        <button
                          onClick={() => alert("Notification preferences updated successfully.")}
                          className="py-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-[9px] transition-colors cursor-pointer"
                        >
                          Save Preferences
                        </button>
                      </div>
                    )}

                    {label === 'Security' && securityExpanded && (
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-800 space-y-4 animate-fade-in text-slate-700 dark:text-slate-350">
                        {/* ── Password Change ── */}
                        <div className="space-y-2">
                          <label className="block text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Current Password</label>
                          <div className="relative">
                            <input
                              type={showCurrentPass ? "text" : "password"}
                              placeholder="Enter current password"
                              value={currentPassword}
                              onChange={e => setCurrentPassword(e.target.value)}
                              className="w-full text-[10px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 pr-8 focus:outline-none focus:border-indigo-500/50"
                            />
                            <button type="button" onClick={() => setShowCurrentPass(p => !p)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400">
                              {showCurrentPass ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>

                          <label className="block text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1">New Password</label>
                          <div className="relative">
                            <input
                              type={showNewPass ? "text" : "password"}
                              placeholder="Enter new password"
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              className="w-full text-[10px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 pr-8 focus:outline-none focus:border-indigo-500/50"
                            />
                            <button type="button" onClick={() => setShowNewPass(p => !p)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400">
                              {showNewPass ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                        </div>

                        {securityStatusMsg && (
                          <div className={`text-[10px] font-bold p-2.5 rounded-lg flex items-center gap-2 animate-fade-in ${
                            securityStatusType === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          }`}>
                            {securityStatusType === 'success' ? <CheckCircle size={14} /> : <X size={14} />}
                            <span>{securityStatusMsg}</span>
                          </div>
                        )}

                        <button
                          onClick={handleUpdateSecurity}
                          disabled={isUpdatingSecurity}
                          className="flex items-center justify-center gap-2 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-[9px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUpdatingSecurity ? (
                            <>
                              <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                              <span>Updating...</span>
                            </>
                          ) : (
                            "Update Security Credentials"
                          )}
                        </button>

                        {/* ── Advanced Settings Accordion ── */}
                        <div className="border-t border-slate-200 dark:border-slate-800/60 pt-3">
                          <button
                            type="button"
                            onClick={() => setAdvancedSettingsExpanded(p => !p)}
                            className="flex items-center justify-between w-full text-left group"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronRight size={13} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${advancedSettingsExpanded ? 'rotate-90' : ''}`} />
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">Advanced Settings</span>
                            </div>
                            {!advancedSettingsExpanded && (
                              <span className="text-[8px] text-slate-400 dark:text-slate-600 italic">Click to expand</span>
                            )}
                          </button>

                          {advancedSettingsExpanded && (
                            <div className="mt-3 space-y-3 animate-fade-in">
                              <div className="space-y-1.5">
                                <label className="block text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Personal OpenRouter API Key <span className="normal-case text-slate-400/60">(Optional)</span></label>
                                <div className="flex gap-2">
                                  <input
                                    type={showApiKey ? "text" : "password"}
                                    placeholder="sk-or-v1-..."
                                    value={customApiKey}
                                    onChange={e => setCustomApiKey(e.target.value)}
                                    className="flex-1 text-[10px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/50 font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowApiKey(p => !p)}
                                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[9px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                  >
                                    {showApiKey ? "Hide" : "Show"}
                                  </button>
                                </div>
                                <p className="text-[8px] text-slate-400 dark:text-slate-500 italic leading-relaxed">
                                  Leave this field empty to use the system's default AI key. Enter your own OpenRouter API key only if you want the application to use your personal OpenRouter account.
                                </p>
                              </div>

                              {apiKeyStatusMsg && (
                                <div className={`text-[10px] font-bold p-2.5 rounded-lg flex items-center gap-2 animate-fade-in ${
                                  apiKeyStatusType === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                }`}>
                                  {apiKeyStatusType === 'success' ? <CheckCircle size={14} /> : <X size={14} />}
                                  <span>{apiKeyStatusMsg}</span>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={handleSaveApiKey}
                                className="py-1.5 px-3 border border-indigo-500/30 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/5 font-semibold rounded-lg text-[9px] transition-colors cursor-pointer"
                              >
                                Save API Key
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {label === 'Appearance' && appearanceExpanded && (
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-800 space-y-4 animate-fade-in text-slate-700 dark:text-slate-350">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="block text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Color Theme Mode</label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => toggleTheme("dark")}
                                className={`flex-1 py-2 px-3 border rounded-xl text-center text-[10px] font-bold transition-all ${
                                  appTheme === "dark"
                                    ? "bg-slate-900 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                🌌 Deep Dark
                              </button>
                              <button
                                onClick={() => toggleTheme("light")}
                                className={`flex-1 py-2 px-3 border rounded-xl text-center text-[10px] font-bold transition-all ${
                                  appTheme === "light"
                                    ? "bg-indigo-600 border-indigo-650 text-white shadow-md"
                                    : "bg-white border-slate-250 text-slate-605 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400"
                                }`}
                              >
                                ☀️ High Light
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">App Text Scale</label>
                            <div className="flex gap-2">
                              {["compact", "standard", "comfortable"].map(sz => (
                                <button
                                  key={sz}
                                  onClick={() => {
                                    setAppFontSize(sz);
                                    showToast(`✓ Text size updated`);
                                  }}
                                  className={`flex-1 py-2 px-1.5 border rounded-xl text-center text-[9px] font-bold capitalize transition-all ${
                                    appFontSize === sz
                                      ? "bg-slate-900 border-indigo-500 text-white dark:bg-slate-800"
                                      : "bg-white border-slate-250 text-slate-605 hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400"
                                  }`}
                                >
                                  {sz}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {label === 'Data & Storage' && storageExpanded && (
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-800 space-y-4 animate-fade-in text-slate-700 dark:text-slate-350">
                        <div className="space-y-2">
                          <label className="block text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Workspace Disk Allocation</label>
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span>Uploaded CSV Files: {datasets.length} files</span>
                            <span className="text-slate-400 font-mono">~154 KB / 100 MB</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800/80 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.max(1, (datasets.length * 1.5))}%` }} />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/50 space-y-3">
                          <label className="block text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Platform Maintenance</label>
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                if (window.confirm("Are you sure you want to clear your query cache? This will force the LLM to execute new query analysis runs.")) {
                                  const token = localStorage.getItem('insightai_token');
                                  axios.post('http://localhost:8000/api/dashboard/cache/clear', {}, {
                                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                                  })
                                  .then(() => alert("Semantic query cache cleared successfully."))
                                  .catch(err => alert("Failed to clear query cache: " + err.message));
                                }
                              }}
                              className="py-1.5 px-3 border border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/5 hover:border-indigo-500/30 font-semibold rounded-lg text-[9px] transition-colors cursor-pointer"
                            >
                              🧹 Clear Query Cache
                            </button>

                            <button
                              onClick={() => {
                                if (window.confirm("Are you sure you want to reset all configurations and clear local dataset storage? This action is irreversible.")) {
                                  alert("System configuration reset complete.");
                                }
                              }}
                              className="py-1.5 px-3 border border-rose-500/20 text-rose-500 hover:bg-rose-500/5 hover:border-rose-500/30 font-semibold rounded-lg text-[9px] transition-colors cursor-pointer"
                            >
                              ⚠️ Wipe Local Storage
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {label === 'Profile' && profileExpanded && (
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-900 space-y-4 animate-fade-in">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm">
                            {user?.email?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">{user?.email}</span>
                            <span className="block text-[9px] text-slate-400 dark:text-slate-550 font-medium">Standard Account</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-200/60 dark:border-slate-900">
                          <div className="text-center p-3 bg-white dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 rounded-xl">
                            <span className="block text-sm font-black text-indigo-500 dark:text-indigo-400">{datasets.length}</span>
                            <span className="block text-[8px] text-slate-405 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Uploaded Files</span>
                          </div>
                          <div className="text-center p-3 bg-white dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 rounded-xl">
                            <span className="block text-sm font-black text-indigo-500 dark:text-indigo-400">{sessions.length}</span>
                            <span className="block text-[8px] text-slate-405 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Chat Sessions</span>
                          </div>
                          <div className="text-center p-3 bg-white dark:bg-slate-900/40 border border-slate-150 dark:border-slate-850 rounded-xl">
                            <span className="block text-sm font-black text-emerald-500 dark:text-emerald-400">Active</span>
                            <span className="block text-[8px] text-slate-405 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Reports Tab</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium animate-fade-in z-50 flex items-center gap-2 border border-slate-700">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
