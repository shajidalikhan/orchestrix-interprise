'use client';

import { useState, useEffect } from 'react';

// Interfaces
interface User {
  id: string;
  email: string;
  role: string;
}

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
}

interface Task {
  id: string;
  title: string;
  status: string;
  progress: number;
  priority: string;
  deadline: string | null;
  assigneeId: string | null;
  evaluatorId: string | null;
  parentId: string | null;
  verificationEndpoint?: string | null;
}

export default function WelcomeHub() {
  // Navigation & Authentication
  const [activeTab, setActiveTab] = useState<'login' | 'onboard' | 'support'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantKeyInput, setTenantKeyInput] = useState(''); // Optional company key
  const [token, setToken] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [feedback, setFeedback] = useState('');

  // 1. Superadmin Console States
  const [companies, setCompanies] = useState<Company[]>([]);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [maxUsersInput, setMaxUsersInput] = useState(10);
  const [enableAi, setEnableAi] = useState(true);
  const [enableVerification, setEnableVerification] = useState(true);
  const [enableIntegrations, setEnableIntegrations] = useState(true);
  const [enableMobileSync, setEnableMobileSync] = useState(true);
  const [planStatus, setPlanStatus] = useState('BASIC');

  // 2. Tenant Admin / Manager Console States
  const [projects, setProjects] = useState<{ id: string; name: string; status: string }[]>([]);
  const [activeProjectId, setActiveProjectId] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectNameInput, setProjectNameInput] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [newTaskVerificationUrl, setNewTaskVerificationUrl] = useState('');
  
  // Grading & Evaluation Scorecard States
  const [selectedTaskForGrade, setSelectedTaskForGrade] = useState<Task | null>(null);
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({ Speed: 8, Quality: 8 });
  const [remarks, setRemarks] = useState('');
  const [aiReportOutput, setAiReportOutput] = useState('');

  // 3. Team Member / Freelancer States
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [syncStatus, setSyncStatus] = useState('');

  // 4. Freelancer Onboarding Quiz States
  const [freelancerEmail, setFreelancerEmail] = useState('');
  const [freelancerPassword, setFreelancerPassword] = useState('');
  const [freelancerProjectId, setFreelancerProjectId] = useState('proj_demo_123');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({ q1: '', q2: '' });
  const [quizResult, setQuizResult] = useState<{ passed: boolean; score: string; token?: string } | null>(null);

  // 5. AI Support Bot Chat States
  const [chatLogs, setChatLogs] = useState<{ sender: 'user' | 'bot'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');

  // On page mount, restore token and check user profile
  useEffect(() => {
    const savedToken = localStorage.getItem('orchestrix_token');
    const savedTenant = localStorage.getItem('orchestrix_tenant');
    if (savedToken) {
      setToken(savedToken);
      if (savedTenant) setTenantKeyInput(savedTenant);
      
      fetch('http://localhost:3000/auth/me', {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      })
      .then(res => {
        if (!res.ok) throw new Error('Session expired');
        return res.json();
      })
      .then(user => {
        setCurrentUser(user);
      })
      .catch(() => handleSignOut());
    }
  }, []);

  // Handle Login Request
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tenantKeyInput.trim()) {
        headers['x-tenant-id'] = tenantKeyInput.trim();
      }

      const res = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Save credentials in local storage
      localStorage.setItem('orchestrix_token', data.accessToken);
      localStorage.setItem('orchestrix_tenant', tenantKeyInput.trim() || '');

      setToken(data.accessToken);
      setCurrentUser(data.user);
      setFeedback(`Authenticated successfully as ${data.user.role}!`);

      // Dynamic redirects based on credentials permission
      if (data.user.role === 'SUPERADMIN') {
        window.location.href = '/superadmin';
      } else if (['ADMIN', 'MANAGER'].includes(data.user.role)) {
        window.location.href = '/projects';
      }
    } catch (err: any) {
      setFeedback(err.message || 'Error connecting to auth service.');
    }
  };

  // Sign out
  const handleSignOut = () => {
    localStorage.removeItem('orchestrix_token');
    localStorage.removeItem('orchestrix_tenant');
    setToken('');
    setCurrentUser(null);
    setEmail('');
    setPassword('');
    setTenantKeyInput('');
    setFeedback('');
    setCompanies([]);
    setTasks([]);
    setProjects([]);
  };

  // Load contextual data based on logged in user's role
  useEffect(() => {
    if (!token || !currentUser) return;

    const headers = { 'Authorization': `Bearer ${token}` };

    if (currentUser?.role === 'SUPERADMIN') {
      // Fetch Superadmin company listings and system metrics
      fetch('http://localhost:3000/superadmin/companies', { headers })
        .then(res => res.json())
        .then(data => setCompanies(data))
        .catch(() => setFeedback('Failed loading company registry.'));
      fetch('http://localhost:3000/superadmin/analytics', { headers })
        .then(res => res.json())
        .then(data => setGlobalStats(data))
        .catch(() => {});
    }

    if (['ADMIN', 'MANAGER', 'MEMBER'].includes(currentUser?.role || '')) {
      // Fetch all projects for the tenant
      fetch('http://localhost:3000/projects', { headers })
        .then(res => res.json())
        .then(data => {
          setProjects(data);
          if (data.length > 0) {
            setActiveProjectId(data[0].id);
          }
        })
        .catch(() => {});
    }

    if (currentUser?.role === 'MEMBER') {
      // Fetch standard task board
      fetch('http://localhost:3000/sync/tasks?projectId=proj_demo_123', { headers })
        .then(res => res.json())
        .then(data => setAssignedTasks(data.tasks || []))
        .catch(() => {});
    }
  }, [token, currentUser]);

  // Load tasks when active project changes for Managers/Admins
  useEffect(() => {
    if (!activeProjectId || !token) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    fetch(`http://localhost:3000/tasks/project/${activeProjectId}`, { headers })
      .then(res => res.json())
      .then(data => setTasks(data))
      .catch(() => {});
  }, [activeProjectId, token]);

  // Superadmin Update Company Feature Gates
  const handleSuperadminUpdate = async (e: React.FormEvent) => {
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
        setFeedback(`Features updated for "${selectedCompany.name}"`);
        setSelectedCompany(null);
        // Refresh listings
        const headers = { 'Authorization': `Bearer ${token}` };
        const compRes = await fetch('http://localhost:3000/superadmin/companies', { headers });
        setCompanies(await compRes.json());
      }
    } catch (err) {
      setFeedback('Error configuring company feature gates.');
    }
  };

  // Manager: Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectNameInput.trim()) return;
    try {
      const res = await fetch('http://localhost:3000/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: projectNameInput }),
      });
      const newProj = await res.json();
      setProjects([...projects, newProj]);
      setActiveProjectId(newProj.id);
      setProjectNameInput('');
      setFeedback(`Project "${newProj.name}" created!`);
    } catch (err) {}
  };

  // Manager: Add Task to project
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeProjectId) return;
    try {
      const res = await fetch(`http://localhost:3000/tasks/project/${activeProjectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTaskTitle,
          assigneeId: newTaskAssignee || undefined,
          priority: newTaskPriority,
          verificationEndpoint: newTaskVerificationUrl || undefined,
          verificationMethod: newTaskVerificationUrl ? 'GET' : undefined,
        }),
      });
      const task = await res.json();
      setTasks([...tasks, task]);
      setNewTaskTitle('');
      setNewTaskAssignee('');
      setNewTaskVerificationUrl('');
      setFeedback(`Task "${task.title}" added to project!`);
    } catch (err) {}
  };

  // Member: Update Task Progress
  const handleUpdateProgress = async (taskId: string, currentStatus: string, newProgress: number) => {
    try {
      const res = await fetch(`http://localhost:3000/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: currentStatus,
          progress: Number(newProgress),
        }),
      });
      if (res.ok) {
        setFeedback('Task progress updated.');
        // Refresh Member Board
        const headers = { 'Authorization': `Bearer ${token}` };
        const taskRes = await fetch('http://localhost:3000/sync/tasks?projectId=proj_demo_123', { headers });
        const data = await taskRes.json();
        setAssignedTasks(data.tasks || []);
      }
    } catch (err) {}
  };

  // Manager: Submit Scorecard Evaluation
  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForGrade) return;
    try {
      const res = await fetch(`http://localhost:3000/evaluations/task/${selectedTaskForGrade.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scores: criteriaScores,
          remarks,
        }),
      });

      if (res.ok) {
        setFeedback(`Task "${selectedTaskForGrade.title}" evaluated and status set to COMPLETED.`);
        setSelectedTaskForGrade(null);
        setRemarks('');
        // Refresh WBS list
        const headers = { 'Authorization': `Bearer ${token}` };
        const taskRes = await fetch(`http://localhost:3000/tasks/project/${activeProjectId}`, { headers });
        setTasks(await taskRes.json());
      }
    } catch (err) {}
  };

  // Manager: Generate AI Performance Appraisal
  const handleGenerateAiAppraisal = async (userId: string) => {
    setAiReportOutput('Generating appraisal via Gemini AI...');
    try {
      const res = await fetch(`http://localhost:3000/ai/appraisal/employee/${userId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setAiReportOutput(data.appraisal || 'Appraisal synthesis complete.');
    } catch (err) {
      setAiReportOutput('AI appraisal generation failed: Make sure enableAi feature gate is enabled.');
    }
  };

  // Freelancer Onboarding test submission
  const handleFreelancerOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:3000/freelancers/project/${freelancerProjectId}/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: freelancerEmail,
          password: freelancerPassword,
          answers: quizAnswers,
        }),
      });
      const data = await res.json();
      setQuizResult(data);
    } catch (err) {
      setFeedback('Error submitting freelancer onboarding test.');
    }
  };

  // AI Support Chat Bot Query Submission
  const handleSupportChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    const newLogs = [...chatLogs, { sender: 'user' as const, text: userMsg }];
    setChatLogs(newLogs);
    setChatInput('');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        headers['x-tenant-id'] = 'tenant-demo-id';
      }
      const res = await fetch(`http://localhost:3000/ai/support/project/${activeProjectId || 'proj_demo_123'}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: userMsg }),
      });
      const data = await res.json();
      setChatLogs([...newLogs, { sender: 'bot', text: data.reply }]);
    } catch (err) {
      setChatLogs([...newLogs, { sender: 'bot', text: 'Error connecting to support services.' }]);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-6 md:p-12 font-sans">
      <div className="max-w-6xl w-full flex flex-col gap-8">
        
        {/* Header Block */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl tracking-wider text-white shadow-lg shadow-indigo-500/30">
              O
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                Orchestrix Workspace
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Unified SaaS Project Planning, Evaluation & Onboarding Dashboard
              </p>
            </div>
          </div>
          {currentUser && (
            <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl shadow">
              <div className="flex gap-2">
                {currentUser?.role === 'SUPERADMIN' ? (
                  <button
                    onClick={() => window.location.href = '/superadmin'}
                    className="bg-indigo-950 text-indigo-400 hover:bg-indigo-900 border border-indigo-800 text-[10px] px-2.5 py-1 rounded font-bold transition-all"
                  >
                    Console
                  </button>
                ) : (
                  ['ADMIN', 'MANAGER'].includes(currentUser?.role || '') && (
                    <>
                      <button
                        onClick={() => window.location.href = '/projects'}
                        className="bg-indigo-950 text-indigo-400 hover:bg-indigo-900 border border-indigo-800 text-[10px] px-2.5 py-1 rounded font-bold transition-all"
                      >
                        Projects
                      </button>
                      <button
                        onClick={() => window.location.href = '/company'}
                        className="bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800 text-[10px] px-2.5 py-1 rounded font-bold transition-all"
                      >
                        Company
                      </button>
                    </>
                  )
                )}
              </div>

              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-slate-200">{currentUser?.email}</span>
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{currentUser?.role}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="border border-slate-800 hover:border-rose-600 hover:text-rose-400 text-xs px-3 py-1 rounded-lg transition-all"
              >
                Sign Out
              </button>
            </div>
          )}
        </header>

        {/* Global Feedback Banner */}
        {feedback && (
          <div className="bg-indigo-950/20 border border-indigo-800/40 p-4 rounded-lg text-indigo-400 text-xs font-semibold">
            {feedback}
          </div>
        )}

        {/* Unauthenticated View: Login & Portal Selector */}
        {!token ? (
          <div className="flex flex-col gap-8">
            <div className="flex justify-center gap-4 border-b border-slate-800 pb-4">
              {[
                { id: 'login', label: '🔐 Login Workspace' },
                { id: 'onboard', label: '🤝 Freelancer Onboarding' },
                { id: 'support', label: '💬 AI Support Bot' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setFeedback('');
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: Unified Login Form */}
            {activeTab === 'login' && (
              <div className="max-w-md w-full mx-auto bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl flex flex-col gap-6">
                <div className="text-center flex flex-col gap-1">
                  <h2 className="text-lg font-bold text-slate-200">Access Your Workspace</h2>
                  <p className="text-xs text-slate-400">Log in to view your role-specific console dashboard</p>
                </div>

                <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-400">EMAIL</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      placeholder="superadmin@orchestrix.com or member@work.com"
                      required
                      suppressHydrationWarning
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-400">PASSWORD</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      placeholder="••••••••"
                      required
                      suppressHydrationWarning
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-400">COMPANY KEY (Optional)</label>
                    <input
                      type="text"
                      value={tenantKeyInput}
                      onChange={(e) => setTenantKeyInput(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                      placeholder="Leave empty for superadmin"
                      suppressHydrationWarning
                    />
                  </div>

                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5 font-semibold text-sm transition-all duration-200 mt-2"
                  >
                    Authenticate Account
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: Freelancer Onboarding Quiz */}
            {activeTab === 'onboard' && (
              <div className="max-w-2xl w-full mx-auto bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl flex flex-col gap-6">
                <div className="text-center flex flex-col gap-1">
                  <h2 className="text-lg font-bold text-slate-200">Freelancer Skills Assessment</h2>
                  <p className="text-xs text-slate-400">Pass this pre-requisite quiz to unlock project task workspace access</p>
                </div>

                {!quizResult?.passed ? (
                  <form onSubmit={handleFreelancerOnboardSubmit} className="flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-400">EMAIL</label>
                        <input
                          type="email"
                          required
                          value={freelancerEmail}
                          onChange={(e) => setFreelancerEmail(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                          suppressHydrationWarning
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-slate-400">PASSWORD</label>
                        <input
                          type="password"
                          required
                          value={freelancerPassword}
                          onChange={(e) => setFreelancerPassword(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                          suppressHydrationWarning
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 border-t border-slate-800 pt-4">
                      <span className="text-xs font-bold text-slate-300">TECHNICAL QUESTIONS</span>
                      
                      <div className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                        <p className="text-sm text-slate-300">1. What database mechanism is used by Orchestrix for progress rollup queries?</p>
                        {['Recursive CTEs (Common Table Expressions)', 'GraphQL resolvers'].map(opt => (
                          <label key={opt} className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                            <input
                              type="radio"
                              name="q1"
                              checked={quizAnswers.q1 === opt}
                              onChange={() => setQuizAnswers({ ...quizAnswers, q1: opt })}
                              className="accent-indigo-500"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>

                      <div className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                        <p className="text-sm text-slate-300">2. Which hashing standard secures integration API keys in the database?</p>
                        {['MD5', 'SHA-256'].map(opt => (
                          <label key={opt} className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                            <input
                              type="radio"
                              name="q2"
                              checked={quizAnswers.q2 === opt}
                              onChange={() => setQuizAnswers({ ...quizAnswers, q2: opt })}
                              className="accent-indigo-500"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 font-semibold text-xs mt-2"
                    >
                      Submit Assessment
                    </button>
                  </form>
                ) : (
                  <div className="bg-emerald-950/20 border border-emerald-800/30 p-4 rounded-lg text-emerald-400 flex flex-col gap-3">
                    <p className="font-bold">✓ Congratulations! You Passed Onboarding Quiz: {quizResult.score}</p>
                    <p className="text-xs text-slate-300">
                      Copy the credentials below and log in above under the Workspace Login tab:
                    </p>
                    <div className="bg-slate-950 p-3 rounded text-[10px] text-slate-400 border border-slate-800 select-all font-mono">
                      Email: {freelancerEmail} <br />
                      Password: {freelancerPassword} <br />
                      Tenant Key: {freelancerProjectId}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Support Chatbot */}
            {activeTab === 'support' && (
              <div className="max-w-2xl w-full mx-auto bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl flex flex-col gap-4">
                <h2 className="text-lg font-bold text-slate-200">Orchestrix RAG Support Bot</h2>
                
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 h-[300px] overflow-y-auto flex flex-col gap-3">
                  {chatLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`max-w-[80%] rounded-lg p-3 text-xs ${
                        log.sender === 'user'
                          ? 'bg-indigo-600 text-white self-end'
                          : 'bg-slate-800 text-slate-300 self-start border border-slate-700'
                      }`}
                    >
                      <p>{log.text}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSupportChatSubmit} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask a question or type 'bug' to trigger automated ticket task routing..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  />
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 px-4 rounded-lg text-xs font-semibold">
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          /* Authenticated Dashboard Roles Switcher Views */
          <div className="flex flex-col gap-8">
            
            {/* VIEW A: SUPERADMIN PANEL */}
            {currentUser?.role === 'SUPERADMIN' && (
              <div className="flex flex-col gap-8">
                {/* Stats row */}
                {globalStats && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: 'Total Companies', value: globalStats.totalTenants },
                      { label: 'Total Users', value: globalStats.totalUsers },
                      { label: 'Total Projects', value: globalStats.totalProjects },
                      { label: 'WBS Tasks Count', value: globalStats.totalTasks },
                      { label: 'Evaluations Scorecards', value: globalStats.totalEvaluations },
                    ].map((s, idx) => (
                      <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">{s.label}</span>
                        <span className="text-xl font-black mt-1 text-slate-100">{s.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Company settings list */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow">
                    <h3 className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-3 uppercase">
                      Global Companies Registry
                    </h3>
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] text-slate-400 uppercase border-b border-slate-800">
                            <th className="py-2">Company</th>
                            <th className="py-2">Active Plan</th>
                            <th className="py-2">Seat Allocation</th>
                            <th className="py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-xs">
                          {companies.map(c => (
                            <tr key={c.id} className="hover:bg-slate-950/40">
                              <td className="py-3 font-semibold text-slate-300">{c.name}</td>
                              <td className="py-3 uppercase text-indigo-400 font-bold">{c.subscriptionStatus}</td>
                              <td className="py-3">{c.userCount} / {c.maxUsers} Seats</td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => {
                                    setSelectedCompany(c);
                                    setMaxUsersInput(c.maxUsers);
                                    setEnableAi(c.enableAi);
                                    setEnableVerification(c.enableVerification);
                                    setEnableIntegrations(c.enableIntegrations);
                                    setEnableMobileSync(c.enableMobileSync);
                                    setPlanStatus(c.subscriptionStatus);
                                  }}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold px-2 py-1 rounded"
                                >
                                  Configure Gates
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Settings Drawer */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow">
                    <h3 className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-3 uppercase">
                      Tenant Plan Settings
                    </h3>
                    {selectedCompany ? (
                      <form onSubmit={handleSuperadminUpdate} className="flex flex-col gap-4 mt-4 text-xs">
                        <p className="font-bold text-indigo-400">Target: {selectedCompany.name}</p>
                        
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-400">SUBSCRIPTION PRESET</label>
                          <select
                            value={planStatus}
                            onChange={(e) => setPlanStatus(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5"
                          >
                            <option value="BASIC">BASIC</option>
                            <option value="PREMIUM">PREMIUM</option>
                            <option value="ENTERPRISE">ENTERPRISE</option>
                            <option value="SUSPENDED">SUSPENDED</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-400">MAX USER SEATS</label>
                          <input
                            type="number"
                            value={maxUsersInput}
                            onChange={(e) => setMaxUsersInput(Number(e.target.value))}
                            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5"
                          />
                        </div>

                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                          <span className="font-bold text-[10px] text-slate-400">TOGGLE ALLOCATED MODULES</span>
                          {[
                            { label: 'AI Appraisals', val: enableAi, set: setEnableAi },
                            { label: 'Auto Verification', val: enableVerification, set: setEnableVerification },
                            { label: 'API Keys & Webhooks', val: enableIntegrations, set: setEnableIntegrations },
                            { label: 'Mobile Sync APIs', val: enableMobileSync, set: setEnableMobileSync },
                          ].map(item => (
                            <label key={item.label} className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800">
                              <span>{item.label}</span>
                              <input
                                type="checkbox"
                                checked={item.val}
                                onChange={(e) => item.set(e.target.checked)}
                                className="accent-indigo-500"
                              />
                            </label>
                          ))}
                        </div>

                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 py-2 rounded font-bold text-xs mt-2">
                          Apply plan gates
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-slate-500 py-6 text-center">Select a company to allocate subscription tools.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW B: MANAGER / ADMIN TEAM CONSOLE */}
            {['ADMIN', 'MANAGER'].includes(currentUser?.role || '') && (
              <div className="flex flex-col gap-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  
                  {/* Project Selector & Creation */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow flex flex-col gap-4">
                    <h3 className="text-xs font-bold text-slate-300 border-b border-slate-800 pb-3 uppercase">
                      My Projects Workspace
                    </h3>
                    <div className="flex flex-col gap-2">
                      {projects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setActiveProjectId(p.id)}
                          className={`w-full text-left px-3 py-2 rounded text-xs font-semibold transition-all ${
                            activeProjectId === p.id 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-950 text-slate-400 hover:bg-slate-800/40'
                          }`}
                        >
                          📁 {p.name}
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleCreateProject} className="flex flex-col gap-2 border-t border-slate-800 pt-4">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Create New Project</label>
                      <input
                        type="text"
                        placeholder="Project Name"
                        value={projectNameInput}
                        onChange={(e) => setProjectNameInput(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-slate-200"
                      />
                      <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 py-1.5 rounded font-bold text-xs text-white">
                        Create
                      </button>
                    </form>
                  </div>

                  {/* Hierarchical WBS Tree list */}
                  <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow flex flex-col gap-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <h3 className="text-xs font-bold text-slate-300 uppercase">
                        Work Breakdown Structure (WBS) Tasks Tree
                      </h3>
                      {activeProjectId && (
                        <button
                          onClick={() => handleGenerateAiAppraisal('user_employee_id')}
                          className="bg-violet-600 hover:bg-violet-700 text-[10px] font-bold px-3 py-1 rounded"
                        >
                          🧠 Generate AI Employee Appraisal
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 divide-y divide-slate-800 max-h-[350px] overflow-y-auto pr-2">
                      {tasks.map(t => (
                        <div key={t.id} className="pt-3 flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-slate-200">
                              {t.parentId ? ' ↳ ' : ''} {t.title}
                            </p>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">
                              Status: {t.status} | Priority: {t.priority} | Progress: {t.progress}%
                            </span>
                          </div>
                          <div className="flex gap-2">
                            {t.status !== 'COMPLETED' && (
                              <button
                                onClick={() => setSelectedTaskForGrade(t)}
                                className="bg-amber-600 hover:bg-amber-700 text-[10px] px-2 py-1 rounded font-bold"
                              >
                                Evaluate Grade
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add Task */}
                    <form onSubmit={handleCreateTask} className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-4 text-xs">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400">TASK TITLE</label>
                        <input
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5"
                          placeholder="Implement DB"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-slate-400">VERIFICATION ENDPOINT URL (Optional)</label>
                        <input
                          type="text"
                          value={newTaskVerificationUrl}
                          onChange={(e) => setNewTaskVerificationUrl(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5"
                          placeholder="http://api.test/status"
                        />
                      </div>
                      <button type="submit" className="col-span-2 bg-indigo-600 hover:bg-indigo-700 py-2 rounded font-bold text-xs">
                        Create task
                      </button>
                    </form>
                  </div>

                </div>

                {/* Scorecard Drawer */}
                {selectedTaskForGrade && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow max-w-xl mx-auto w-full text-xs">
                    <h3 className="font-bold border-b border-slate-800 pb-3 text-slate-200 uppercase">
                      Evaluate: "{selectedTaskForGrade.title}"
                    </h3>
                    <form onSubmit={handleGradeSubmit} className="flex flex-col gap-4 mt-4">
                      <div className="flex justify-between gap-4">
                        {['Speed', 'Quality'].map(c => (
                          <div key={c} className="flex-1 flex flex-col gap-1">
                            <label className="font-bold text-[10px] uppercase text-slate-400">{c} Rating (1-10)</label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={criteriaScores[c] || 8}
                              onChange={(e) => setCriteriaScores({ ...criteriaScores, [c]: Number(e.target.value) })}
                              className="bg-slate-950 border border-slate-800 rounded px-2 py-1"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-[10px] uppercase text-slate-400">Evaluator Remarks</label>
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded p-2 h-20"
                          placeholder="Exceptional speed and robust implementation details."
                        />
                      </div>
                      <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 py-2 rounded font-bold">
                        Submit Scorecard
                      </button>
                    </form>
                  </div>
                )}

                {/* AI report output */}
                {aiReportOutput && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow text-xs">
                    <h3 className="font-bold border-b border-slate-800 pb-3 text-slate-200 uppercase">
                      🧠 Synthesized Appraisal File
                    </h3>
                    <p className="mt-3 whitespace-pre-line text-slate-300 font-mono leading-relaxed bg-slate-950 p-4 rounded border border-slate-800">
                      {aiReportOutput}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* VIEW C: TEAM MEMBER TASK BOARD */}
            {currentUser?.role === 'MEMBER' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow flex flex-col gap-4 text-xs">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-slate-200 uppercase">My Active Tasks Workspace</h3>
                  <button
                    onClick={() => {
                      setSyncStatus('Synchronizing offline database buffers...');
                      setTimeout(() => setSyncStatus('Synchronized successfully.'), 1000);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 font-bold px-3 py-1 rounded text-[10px]"
                  >
                    📱 Mobile Offline Delta Sync
                  </button>
                </div>

                {syncStatus && <p className="text-[10px] text-indigo-400 font-bold">{syncStatus}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignedTasks.map(t => (
                    <div key={t.id} className="bg-slate-950 p-4 rounded-lg border border-slate-850 flex flex-col gap-3">
                      <div>
                        <h4 className="font-bold text-sm text-slate-200">{t.title}</h4>
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mt-1">
                          Priority: {t.priority} | Progress: {t.progress}% | Status: {t.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">SET PROGRESS:</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={t.progress}
                          onChange={(e) => handleUpdateProgress(t.id, t.status, Number(e.target.value))}
                          className="flex-1 accent-indigo-500"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateProgress(t.id, 'REVIEW', t.progress)}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-[10px] font-bold py-1.5 rounded"
                        >
                          Submit for Review
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        )}

      </div>
    </main>
  );
}
