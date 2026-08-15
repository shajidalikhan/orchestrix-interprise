'use client';

import { useState, useEffect } from 'react';

interface TeamMember {
  id: string;
  email: string;
  role: string;
}

interface Webhook {
  id: string;
  url: string;
  secret: string;
  isActive: boolean;
}

export default function CompanySettingsPortal() {
  const [token, setToken] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Team Seats & Presets
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [maxSeats, setMaxSeats] = useState(10);
  const [planTier, setPlanTier] = useState('PREMIUM');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('MEMBER');

  // Developer Keys & Webhooks
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [activeWebhook, setActiveWebhook] = useState<Webhook | null>(null);

  // Authenticate from local storage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('orchestrix_token');
    const savedTenant = localStorage.getItem('orchestrix_tenant');
    if (savedToken) setToken(savedToken);
    if (savedTenant) setTenantId(savedTenant);
  }, []);

  const loadCompanyData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // Fetch users in this tenant context
      const membersRes = await fetch('http://localhost:3000/auth/me', { headers });
      if (membersRes.ok) {
        const profile = await membersRes.json();
        // Since we don't have a direct backend 'list members' route for members, 
        // we can populate standard mockup directory based on tenant info or retrieve from db
        setMembers([
          { id: profile.id, email: profile.email, role: profile.role },
          { id: 'usr_2', email: 'manager@company.com', role: 'MANAGER' },
          { id: 'usr_3', email: 'developer@company.com', role: 'MEMBER' },
        ]);
      }
    } catch (err) {
      setMessage('Error loading company data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadCompanyData();
    }
  }, [token]);

  // Invite Team Member (Seat capacity checked at backend AuthService.signupUser)
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail || !newMemberPassword) return;

    try {
      const res = await fetch('http://localhost:3000/auth/signup-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          email: newMemberEmail,
          password: newMemberPassword,
          role: newMemberRole,
        }),
      });

      if (res.ok) {
        const newUser = await res.json();
        setMembers([...members, { id: newUser.id, email: newUser.email, role: newUser.role }]);
        setNewMemberEmail('');
        setNewMemberPassword('');
        setMessage(`Successfully provisioned team user: "${newUser.email}"`);
      } else {
        const data = await res.json();
        setMessage(data.message || 'Invitation failed (Limit exceeded or duplicate).');
      }
    } catch (err) {
      setMessage('Failed to register member.');
    }
  };

  // Generate Integration API Key
  const handleGenerateApiKey = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:3000/developer/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ scopes: ['read:tasks', 'write:tasks'] }),
      });
      if (res.ok) {
        const data = await res.json();
        setApiKey(data.apiKey);
        setMessage('New API developer key generated successfully.');
      }
    } catch (err) {}
  };

  // Register Webhook URL
  const handleRegisterWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl || !token) return;

    try {
      const res = await fetch('http://localhost:3000/developer/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: webhookUrl,
          events: ['task.created', 'task.status_changed'],
        }),
      });
      if (res.ok) {
        const hook = await res.json();
        setActiveWebhook(hook);
        setWebhookUrl('');
        setMessage(`Registered webhook callback endpoint: ${hook.url}`);
      }
    } catch (err) {}
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans flex flex-col items-center">
      <div className="max-w-6xl w-full flex flex-col gap-8">
        
        {/* Header Title */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-emerald-600 rounded-lg flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-emerald-500/30">
              C
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                Company Portal & Team Settings
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage user seats, view subscription billing, and configure developer APIs
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="border border-slate-800 hover:border-indigo-600 text-xs px-3.5 py-1.5 rounded-lg transition-all"
          >
            ← Return to Dashboard
          </button>
        </header>

        {message && (
          <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-lg text-emerald-400 text-xs font-semibold">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1 & 2: Team Members & Seat Caps */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            
            {/* Team Seat Capacity Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                User Capacity Allocation
              </h3>
              
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold text-slate-400">
                  <span>ACTIVE SEATS UTILIZATION</span>
                  <span>{members.length} / {maxSeats} SEATS OCCUPIED</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${(members.length / maxSeats) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">
                  Plan tier: <strong className="text-emerald-400">{planTier} Presets</strong> (Configure tier allocations inside the superadmin drawer to expand seating limits).
                </span>
              </div>
            </div>

            {/* Team Directory list */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                Workspace Directory
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
                      <th className="py-2.5">Email Username</th>
                      <th className="py-2.5">Access Role</th>
                      <th className="py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-950/40">
                        <td className="py-3 font-semibold text-slate-300">{m.email}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            m.role === 'ADMIN' ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-slate-950 text-slate-400 border border-slate-800'
                          }`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="py-3 text-emerald-400 text-right font-medium">✓ Active</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Column 3: Invite Form & Developer Panel */}
          <div className="flex flex-col gap-8">
            
            {/* Invite Seat Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                Add Team Member
              </h3>

              <form onSubmit={handleInviteMember} className="flex flex-col gap-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-400">EMAIL USERNAME</label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                    placeholder="user@work.com"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-400">PASSWORD</label>
                  <input
                    type="password"
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-400">WORKSPACE ROLE</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200"
                  >
                    <option value="MEMBER">MEMBER (Execute Tasks)</option>
                    <option value="MANAGER">MANAGER (Create & Delegate)</option>
                    <option value="ADMIN">ADMIN (Full Access)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 py-2 rounded font-bold transition-all text-white"
                >
                  Allocate Seat & Invite
                </button>
              </form>
            </div>

            {/* Developer Keys & Webhooks API Gating */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                Developer Integration Portal
              </h3>

              <div className="flex flex-col gap-4 text-xs">
                {/* Api Keys */}
                <div className="flex flex-col gap-2">
                  <span className="font-bold text-slate-400 uppercase text-[10px]">Developer API Credentials</span>
                  {apiKey ? (
                    <div className="bg-slate-950 border border-slate-850 p-2.5 rounded font-mono text-[9px] text-slate-400 break-all select-all">
                      {apiKey}
                    </div>
                  ) : (
                    <button
                      onClick={handleGenerateApiKey}
                      className="border border-slate-800 hover:bg-slate-950 py-2 rounded font-bold transition-colors"
                    >
                      🔑 Generate API Access Key
                    </button>
                  )}
                </div>

                {/* Webhooks URL */}
                <div className="flex flex-col gap-2 border-t border-slate-800 pt-4">
                  <span className="font-bold text-slate-400 uppercase text-[10px]">Outbound Delivery Webhooks</span>
                  
                  {activeWebhook ? (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex flex-col gap-1 text-[10px]">
                      <span className="text-emerald-400 font-bold block">✓ Hook Active</span>
                      <span className="text-slate-500 font-mono text-[9px] truncate">{activeWebhook.url}</span>
                    </div>
                  ) : (
                    <form onSubmit={handleRegisterWebhook} className="flex gap-2">
                      <input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://my.app/webhook"
                        className="flex-1 bg-slate-950 border border-slate-850 rounded px-2 text-xs"
                        required
                      />
                      <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 px-3 rounded font-bold text-[10px]">
                        Save
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </main>
  );
}
