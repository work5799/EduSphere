import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api, setToken, setCurrentUser } from '../utils/api';
import { GraduationCap, ArrowLeft, Eye, EyeOff, Loader, Lock, Mail, User, Phone } from 'lucide-react';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract initial tab from URL search parameters or state
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') === 'register' ? 'register' : 'login';
  
  const [isLogin, setIsLogin] = useState(initialTab === 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Info message from landing page if redirected
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    // Keep tab in sync with URL queries if they change
    const tab = queryParams.get('tab');
    if (tab) {
      setIsLogin(tab !== 'register');
    }
    
    // Check if redirect message is passed in state
    if (location.state && (location.state as any).message) {
      setInfoMessage((location.state as any).message);
    }
  }, [location.search, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isLogin) {
        // Handle Login
        const data = await api.login({ email, password });
        setToken(data.token);
        setCurrentUser(data.user);
        
        // Redirect based on role and status
        if (data.user.role === 'admin') {
          navigate('/admin');
        } else if (data.user.status === 'pending') {
          navigate('/pending');
        } else {
          navigate('/dashboard');
        }
      } else {
        // Handle Student Registration
        const data = await api.register({ name, email, password, phone });
        setSuccess(data.message);
        setIsLogin(true); // Switch to login after successful register
        // Clear fields
        setName('');
        setPhone('');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center py-12 px-6 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06),transparent_50%)]" />
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl" />
      <div className="bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl" />

      {/* Back button */}
      <Link 
        to="/" 
        className="absolute top-8 left-8 flex items-center gap-2 text-slate-400 hover:text-white transition duration-300 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm font-medium z-10"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Courses
      </Link>

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-600/30 mb-4">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
            {isLogin ? 'Welcome back to EduSphere' : 'Create Student Account'}
          </h2>
          <p className="text-slate-500 mt-2 text-sm">
            {isLogin ? 'Login to continue your learning journey' : 'Register and await admin account activation'}
          </p>
        </div>

        {/* Auth Box */}
        <div className="glass-premium rounded-3xl p-8 shadow-2xl relative">
          
          {/* Info messages */}
          {infoMessage && (
            <div className="mb-6 p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-sm">
              {infoMessage}
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm">
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-900 mb-6">
            <button
              onClick={() => {
                setIsLogin(true);
                setError('');
                setInfoMessage('');
              }}
              className={`flex-1 py-2 text-center rounded-lg text-sm font-semibold transition cursor-pointer ${
                isLogin 
                  ? 'bg-indigo-600 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError('');
                setInfoMessage('');
              }}
              className={`flex-1 py-2 text-center rounded-lg text-sm font-semibold transition cursor-pointer ${
                !isLogin 
                  ? 'bg-indigo-600 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Full Name</label>
                <div className="relative rounded-xl bg-slate-950 border border-slate-800 focus-within:border-indigo-500 transition duration-300 flex items-center px-3.5 py-3">
                  <User className="h-5 w-5 text-slate-500 flex-shrink-0" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="bg-transparent border-0 focus:outline-none focus:ring-0 text-white placeholder-slate-650 w-full px-3 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
              <div className="relative rounded-xl bg-slate-950 border border-slate-800 focus-within:border-indigo-500 transition duration-300 flex items-center px-3.5 py-3">
                <Mail className="h-5 w-5 text-slate-500 flex-shrink-0" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="bg-transparent border-0 focus:outline-none focus:ring-0 text-white placeholder-slate-650 w-full px-3 text-sm"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Phone Number (Optional)</label>
                <div className="relative rounded-xl bg-slate-950 border border-slate-800 focus-within:border-indigo-500 transition duration-300 flex items-center px-3.5 py-3">
                  <Phone className="h-5 w-5 text-slate-500 flex-shrink-0" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="bg-transparent border-0 focus:outline-none focus:ring-0 text-white placeholder-slate-650 w-full px-3 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
              <div className="relative rounded-xl bg-slate-950 border border-slate-800 focus-within:border-indigo-500 transition duration-300 flex items-center px-3.5 py-3">
                <Lock className="h-5 w-5 text-slate-500 flex-shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent border-0 focus:outline-none focus:ring-0 text-white placeholder-slate-650 w-full px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-3.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>{isLogin ? 'Sign In' : 'Register Account'}</span>
              )}
            </button>
          </form>
          
          {isLogin && (
            <div className="mt-6 text-center text-xs text-slate-500 leading-relaxed border-t border-slate-900 pt-6">
              <span className="font-semibold text-indigo-400">Admin Account Seed:</span><br />
              Email: <code className="text-slate-400">admin@edusphere.com</code> | Password: <code className="text-slate-400">adminpassword</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
