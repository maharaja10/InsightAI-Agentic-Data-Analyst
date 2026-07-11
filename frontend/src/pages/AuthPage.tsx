import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { Zap, Mail, Lock, User, Eye, EyeOff, AlertCircle, Sparkles, BarChart2, Shield } from 'lucide-react';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const { login, register } = useAuth();

  const [mode,        setMode]        = useState<Mode>('login');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [error,       setError]       = useState('');
  const [successMsg,  setSuccessMsg]  = useState('');
  const [loading,     setLoading]     = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName || undefined);
        setSuccessMsg('Account created successfully. Please sign in.');
        setMode('login');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m); setError(''); setSuccessMsg(''); setEmail(''); setPassword(''); setDisplayName('');
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 font-sans relative overflow-hidden">

      {/* ── Ambient glows ── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/15 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-purple-600/15 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[160px]" />
      </div>

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex w-[52%] flex-col justify-between p-14 relative">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-none">InsightAI</h1>
            <span className="text-[11px] text-slate-500">Data Analyst Platform</span>
          </div>
        </div>

        {/* Hero text */}
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 font-semibold">
              <Sparkles size={10} className="animate-pulse" />
              AI-Powered Analytics
            </div>
            <h2 className="text-4xl font-black text-white leading-tight">
              Turn data into<br />
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                decisions instantly
              </span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              Upload a CSV, ask questions in plain English, get charts, insights, and anomaly reports — all in seconds.
            </p>
          </div>

          {/* Feature pills */}
          <div className="space-y-2.5">
            {[
              { icon: BarChart2, label: 'Instant Visualizations', desc: 'Auto-generate charts from natural language' },
              { icon: Sparkles,  label: 'AI Business Insights',   desc: 'Executive summaries powered by LLM agents' },
              { icon: Shield,    label: 'Your Data, Your Account', desc: 'All history saved securely per account'    },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">{label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-slate-700">© 2026 InsightAI. All rights reserved.</p>
      </div>

      {/* ── Right auth card ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-md">

          {/* Card */}
          <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-8 shadow-2xl shadow-black/40">

            {/* Logo (mobile only) */}
            <div className="flex lg:hidden items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Zap size={15} className="text-white" />
              </div>
              <span className="text-sm font-bold text-white">InsightAI</span>
            </div>

            {/* Title */}
            <div className="mb-6">
              <h3 className="text-xl font-black text-white mb-1">
                {mode === 'login' ? 'Welcome back 👋' : 'Create your account'}
              </h3>
              <p className="text-xs text-slate-400">
                {mode === 'login'
                  ? 'Sign in to access your data and sessions'
                  : 'Start analysing your data in seconds'}
              </p>
            </div>

            {/* Mode switcher */}
            <div className="flex gap-1 p-1 rounded-xl bg-slate-800/60 border border-slate-700/40 mb-6">
              {(['login', 'register'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer capitalize ${
                    mode === m
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Display name (register only) */}
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Display Name</label>
                  <div className="relative">
                    <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Your name (optional)"
                      className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:bg-slate-800 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:bg-slate-800 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:bg-slate-800 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-fade-in">
                  <AlertCircle size={12} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success */}
              {successMsg && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs animate-fade-in">
                  <Shield size={12} className="flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 cursor-pointer"
              >
                {loading
                  ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                  : (mode === 'login' ? 'Sign In'       : 'Create Account')
                }
              </button>
            </form>

            {/* Footer switch */}
            <p className="text-center text-[11px] text-slate-500 mt-5">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
              >
                {mode === 'login' ? 'Register' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
