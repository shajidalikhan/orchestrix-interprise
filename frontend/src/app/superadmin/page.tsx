'use client';

import { useState, useEffect } from 'react';

interface Company {
  id: string;
  name: string;
  domain: string | null;
  subscriptionStatus: string;
  maxUsers: number;
  enableAi: boolean;
  enableVerification: boolean;
  enableIntegrations: boolean;
  enableMobileSync: boolean;
  userCount: number;
  createdAt: string;
}

interface Stats {
  totalTenants: number;
  totalUsers: number;
  totalProjects: number;
  totalTasks: number;
  totalEvaluations: number;
}

export default function SuperadminPortal() {
  // Credentials & Session
  const [email, setEmail] = useState('superadmin@orchestrix.com');
  const [password, setPassword] = useState('orchestrixadmin123!');
  const [token, setToken] = useState<string>('');
  const [loginError, setLoginError] = useState('');
  
  // Data States
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Selected Company for Feature Gating Edit
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [maxUsersInput, setMaxUsersInput] = useState(10);
  const [enableAi, setEnableAi] = useState(true);
  const [enableVerification, setEnableVerification] = useState(true);
  const [enableIntegrations, setEnableIntegrations] = useState(true);
  const [enableMobileSync, setEnableMobileSync] = useState(true);
  const [planStatus, setPlanStatus] = useState('BASIC');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }
      setToken(data.accessToken);
      setMessage('Successfully authenticated as Superuser!');
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [companiesRes, statsRes] = await Promise.all([
        fetch('http://localhost:3000/superadmin/companies', { headers }),
        fetch('http://localhost:3000/superadmin/analytics', { headers }),
      ]);

      if (companiesRes.ok && statsRes.ok) {
        const companiesData = await companiesRes.json();
        const statsData = await statsRes.json();
        setCompanies(companiesData);
        setStats(statsData);
      }
    } catch (err) {
      setMessage('Error loading admin dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const selectCompanyForEdit = (company: Company) => {
    setSelectedCompany(company);
    setMaxUsersInput(company.maxUsers);
    setEnableAi(company.enableAi);
    setEnableVerification(company.enableVerification);
    setEnableIntegrations(company.enableIntegrations);
    setEnableMobileSync(company.enableMobileSync);
    setPlanStatus(company.subscriptionStatus);
  };

  const handleFeatureUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany || !token) return;

    try {
      const res = await fetch(`http://localhost:3000/superadmin/companies/${selectedCompany.id}/features`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          maxUsers: Number(maxUsersInput),
          enableAi,
          enableVerification,
          enableIntegrations,
          enableMobileSync,
          subscriptionStatus: planStatus,
        }),
      });

      if (res.ok) {
        setMessage(`Successfully updated feature configurations for company: "${selectedCompany.name}"`);
        setSelectedCompany(null);
        fetchDashboardData();
      } else {
        const data = await res.json();
        setMessage(data.message || 'Failed to update configurations.');
      }
    } catch (err) {
      setMessage('Error updating tenant configurations.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans flex flex-col items-center">
      <div className="max-w-6xl w-full flex flex-col gap-8">
        
        {/* Header Title */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-500/30">
              S
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                Orchestrix Superuser Admin Console
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Central multi-tenant control panel and plan gating dashboard
              </p>
            </div>
          </div>
          {token && (
            <button
              onClick={() => setToken('')}
              className="border border-slate-800 hover:border-rose-600 hover:text-rose-400 text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
            >
              Sign Out
            </button>
          )}
        </header>

        {/* 1. Login State */}
        {!token ? (
          <div className="max-w-md w-full mx-auto mt-12 bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl flex flex-col gap-6">
            <div className="flex flex-col gap-1 text-center">
              <h2 className="text-lg font-bold text-slate-200">Authenticate Superadmin</h2>
              <p className="text-xs text-slate-400">Access system-wide analytics and company subscriptions</p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400">SUPERADMIN EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                  suppressHydrationWarning
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400">SUPERADMIN PASSWORD</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                  suppressHydrationWarning
                />
              </div>

              {loginError && (
                <p className="text-xs font-semibold text-rose-400 bg-rose-900/10 p-3 rounded-lg">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5 font-semibold text-sm transition-all duration-200"
              >
                Sign In to Admin Console
              </button>
            </form>
          </div>
        ) : (
          /* 2. Main Dashboard Panel */
          <div className="flex flex-col gap-8">
            
            {/* System Status Metrics Cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Total Companies', value: stats.totalTenants, border: 'border-indigo-500/30' },
                  { label: 'Registered Users', value: stats.totalUsers, border: 'border-violet-500/30' },
                  { label: 'Active Projects', value: stats.totalProjects, border: 'border-emerald-500/30' },
                  { label: 'WBS Tasks Count', value: stats.totalTasks, border: 'border-amber-500/30' },
                  { label: 'Graded Scorecards', value: stats.totalEvaluations, border: 'border-sky-500/30' },
                ].map((s, idx) => (
                  <div key={idx} className={`bg-slate-900 border ${s.border} rounded-xl p-4 shadow-md flex flex-col gap-1`}>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{s.label}</span>
                    <span className="text-2xl font-extrabold text-slate-100">{s.value}</span>
                  </div>
                ))}
              </div>
            )}

            {message && (
              <div className="bg-indigo-950/20 border border-indigo-800/40 p-4 rounded-lg text-indigo-400 text-xs font-semibold">
                {message}
              </div>
            )}

            {/* List and Gate editor */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Companies Table */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
                <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                  Company Tenant Registry
                </h3>

                {loading ? (
                  <p className="text-xs text-slate-400 text-center py-6">Loading registered companies...</p>
                ) : companies.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No tenant companies registered yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
                          <th className="py-3 px-2">Company Name</th>
                          <th className="py-3 px-2">Seats Used</th>
                          <th className="py-3 px-2">Active Plan</th>
                          <th className="py-3 px-2 text-right">Settings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-xs">
                        {companies.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-950/40 transition-colors">
                            <td className="py-3.5 px-2 font-semibold text-slate-200">
                              <div>{c.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">{c.id.slice(0, 8)}...</div>
                            </td>
                            <td className="py-3.5 px-2 text-slate-300">
                              <span className="font-bold text-slate-100">{c.userCount}</span> / {c.maxUsers}
                            </td>
                            <td className="py-3.5 px-2">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                                c.subscriptionStatus === 'ENTERPRISE' 
                                  ? 'bg-indigo-950 text-indigo-400 border border-indigo-800' 
                                  : c.subscriptionStatus === 'PREMIUM'
                                  ? 'bg-violet-950 text-violet-400 border border-violet-800'
                                  : 'bg-slate-950 text-slate-400 border border-slate-800'
                              }`}>
                                {c.subscriptionStatus}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 text-right">
                              <button
                                onClick={() => selectCompanyForEdit(c)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold px-2.5 py-1 rounded transition-colors"
                              >
                                Configure Plan
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Dynamic Feature Gating Drawer Panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
                <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                  Feature Gate Allocator
                </h3>

                {selectedCompany ? (
                  <form onSubmit={handleFeatureUpdate} className="flex flex-col gap-5">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Selected Target</span>
                      <span className="text-sm font-bold text-indigo-400">{selectedCompany.name}</span>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-slate-400">PLAN TIER PRESET</label>
                      <select
                        value={planStatus}
                        onChange={(e) => setPlanStatus(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="BASIC">BASIC PLAN</option>
                        <option value="PREMIUM">PREMIUM PLAN</option>
                        <option value="ENTERPRISE">ENTERPRISE PLAN</option>
                        <option value="SUSPENDED">SUSPENDED / PAST DUE</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-slate-400">USER CAPACITY (SEAT LIMIT)</label>
                      <input
                        type="number"
                        min="1"
                        value={maxUsersInput}
                        onChange={(e) => setMaxUsersInput(Number(e.target.value))}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
                      <span className="text-xs font-bold text-slate-300">ALLOCATE ACTIVE TOOL MODULES</span>
                      
                      {[
                        { label: '🧠 AI Appraisal & Chatbot Suite', value: enableAi, setter: setEnableAi },
                        { label: '⚡ HTTP Automated Verification', value: enableVerification, setter: setEnableVerification },
                        { label: '🔑 Developer API Keys & Webhooks', value: enableIntegrations, setter: setEnableIntegrations },
                        { label: '📱 Mobile Badges & Sync', value: enableMobileSync, setter: setEnableMobileSync },
                      ].map((item, idx) => (
                        <label key={idx} className="flex items-center justify-between bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40 cursor-pointer select-none">
                          <span className="text-xs text-slate-300 font-medium">{item.label}</span>
                          <input
                            type="checkbox"
                            checked={item.value}
                            onChange={(e) => item.setter(e.target.checked)}
                            className="h-4 w-4 rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500 accent-indigo-500"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCompany(null)}
                        className="flex-1 border border-slate-800 hover:bg-slate-950 text-slate-400 rounded-lg py-2 font-semibold text-xs transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 font-semibold text-xs transition-colors"
                      >
                        Save Configurations
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-12 bg-slate-950/20 border border-dashed border-slate-800 rounded-xl">
                    <span className="text-[32px] text-slate-600">⚙</span>
                    <p className="text-xs text-slate-400 mt-2 px-6">
                      Select a company from the registry to adjust seat capacity and toggle module access.
                    </p>
                  </div>
                )}

              </div>

            </div>

          </div>
        )}

      </div>
    </main>
  );
}
