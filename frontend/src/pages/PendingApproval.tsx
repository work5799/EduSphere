import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getCurrentUser, setCurrentUser, removeToken } from '../utils/api';
import { GraduationCap, Clock, RefreshCw, LogOut } from 'lucide-react';

export default function PendingApproval() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const cachedUser = getCurrentUser();
    if (!cachedUser) {
      navigate('/auth');
      return;
    }
    setUser(cachedUser);
    
    // If user is already approved, direct them out
    if (cachedUser.role === 'admin') {
      navigate('/admin');
    } else if (cachedUser.status === 'approved') {
      navigate('/dashboard');
    }
  }, [navigate]);

  const checkStatus = async () => {
    setChecking(true);
    setError('');
    try {
      const data = await api.getMe();
      const freshUser = data.user;
      setCurrentUser(freshUser);
      setUser(freshUser);

      if (freshUser.status === 'approved') {
        navigate('/dashboard');
      } else if (freshUser.status === 'rejected') {
        setError('Your account request has been rejected by the administrator.');
      } else {
        // Still pending
        setError('Your account status is still pending admin review.');
      }
    } catch (err: any) {
      setError(err.message || 'Error checking status.');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    removeToken();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center py-12 px-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.04),transparent_50%)]" />
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-indigo-500/5 blur-3xl" />
      
      <div className="w-full max-w-md relative z-10 text-center">
        {/* Brand */}
        <div className="inline-flex bg-indigo-600/10 p-2.5 rounded-2xl border border-indigo-500/20 mb-8">
          <GraduationCap className="h-7 w-7 text-indigo-400" />
        </div>

        {/* Content Box */}
        <div className="glass-premium rounded-3xl p-8 shadow-2xl">
          <div className="inline-flex bg-amber-500/10 border border-amber-500/25 p-4 rounded-full mb-6">
            <Clock className="h-10 w-10 text-amber-400 animate-pulse" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-3">
            Registration Pending
          </h2>
          
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            Hello, <strong className="text-slate-200">{user?.name}</strong>. Your EduSphere student account registration was received successfully.
            To protect our platform's contents, all student accounts must be approved by our Administrator before course access is unlocked.
          </p>

          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-900 text-left space-y-2 mb-8 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <span>Account Status:</span>
              <span className="bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full font-semibold border border-amber-500/20">
                {user?.status ? user.status.toUpperCase() : 'PENDING'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Email Registered:</span>
              <span className="text-slate-350 font-medium">{user?.email}</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/20 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={checkStatus}
              disabled={checking}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              <span>Refresh Account Status</span>
            </button>
            
            <button
              onClick={handleLogout}
              className="w-full hover:bg-slate-900 text-slate-400 hover:text-white font-semibold py-3 rounded-xl border border-slate-800 transition duration-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out & Home</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
