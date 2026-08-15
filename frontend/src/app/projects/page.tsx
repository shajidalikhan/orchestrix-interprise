'use client';

import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  progress: number;
  priority: string;
  assigneeId: string | null;
  parentId: string | null;
  verificationEndpoint?: string | null;
}

export default function ProjectsWbsPortal() {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Projects & Active Project
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjId, setActiveProjId] = useState('');
  const [newProjectName, setNewProjectName] = useState('');

  // Tasks & Tree
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [newTaskVerificationUrl, setNewTaskVerificationUrl] = useState('');
  const [newTaskParentId, setNewTaskParentId] = useState('');

  // Scorecards & AI Appraisals
  const [selectedTaskForScorecard, setSelectedTaskForScorecard] = useState<Task | null>(null);
  const [critScores, setCritScores] = useState<Record<string, number>>({ Speed: 8, Quality: 8 });
  const [remarks, setRemarks] = useState('');
  const [appraisalUserId, setAppraisalUserId] = useState('');
  const [aiReport, setAiReport] = useState('');

  // Authenticate on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('orchestrix_token');
    if (savedToken) {
      setToken(savedToken);
    } else {
      window.location.href = '/';
    }
  }, []);

  const loadProjects = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch('http://localhost:3000/projects', { headers });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (data.length > 0 && !activeProjId) {
          setActiveProjId(data[0].id);
        }
      }
    } catch (err) {
      setMessage('Failed loading project directories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadProjects();
    }
  }, [token]);

  // Load WBS Tasks tree when project changes
  const loadTasksTree = async () => {
    if (!activeProjId || !token) return;
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const res = await fetch(`http://localhost:3000/tasks/project/${activeProjId}`, { headers });
      if (res.ok) {
        setTasks(await res.json());
      }
    } catch (err) {}
  };

  useEffect(() => {
    loadTasksTree();
  }, [activeProjId, token]);

  // Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !token) return;

    try {
      const res = await fetch('http://localhost:3000/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newProjectName }),
      });
      if (res.ok) {
        const proj = await res.json();
        setProjects([...projects, proj]);
        setActiveProjId(proj.id);
        setNewProjectName('');
        setMessage(`Successfully initialized project workspace: "${proj.name}"`);
      }
    } catch (err) {}
  };

  // Add Task/Subtask to Tree
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeProjId || !token) return;

    try {
      const res = await fetch(`http://localhost:3000/tasks/project/${activeProjId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTaskTitle,
          assigneeId: newTaskAssignee || undefined,
          priority: newTaskPriority,
          parentId: newTaskParentId || undefined,
          verificationEndpoint: newTaskVerificationUrl || undefined,
          verificationMethod: newTaskVerificationUrl ? 'GET' : undefined,
        }),
      });

      if (res.ok) {
        setMessage(`Task created: "${newTaskTitle}"`);
        setNewTaskTitle('');
        setNewTaskAssignee('');
        setNewTaskVerificationUrl('');
        setNewTaskParentId('');
        loadTasksTree();
      }
    } catch (err) {}
  };

  // Submit Task Performance scorecard evaluation
  const handleScorecardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForScorecard || !token) return;

    try {
      const res = await fetch(`http://localhost:3000/evaluations/task/${selectedTaskForScorecard.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scores: critScores,
          remarks,
        }),
      });

      if (res.ok) {
        setMessage(`Task scorecard submitted successfully. Status updated to COMPLETED.`);
        setSelectedTaskForScorecard(null);
        setRemarks('');
        loadTasksTree();
      }
    } catch (err) {}
  };

  // Trigger Gemini AI appraisal synthesis report
  const handleSynthesizeAppraisal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appraisalUserId || !token) return;

    setAiReport('Querying Google Generative AI synthesis model...');
    try {
      const res = await fetch(`http://localhost:3000/ai/appraisal/employee/${appraisalUserId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAiReport(data.appraisal);
      } else {
        const errData = await res.json();
        setAiReport(`Failed: ${errData.message || 'Verification failed.'}`);
      }
    } catch (err) {
      setAiReport('Generative model offline. Please check that enableAi preset is enabled on your tenant company plan.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans flex flex-col items-center">
      <div className="max-w-6xl w-full flex flex-col gap-8">
        
        {/* Header Title */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-500/30">
              P
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                WBS Project Workspace
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Outline hierarchical work breakdown schedules, trigger evaluations, and synthesize performance reports
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/'}
            className="border border-slate-800 hover:border-emerald-600 text-xs px-3.5 py-1.5 rounded-lg transition-all"
          >
            ← Return to Dashboard
          </button>
        </header>

        {message && (
          <div className="bg-indigo-950/20 border border-indigo-800/40 p-4 rounded-lg text-indigo-400 text-xs font-semibold">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1: Projects Selector & Creation */}
          <div className="flex flex-col gap-6">
            
            {/* Project List */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                My Projects
              </h3>

              {loading ? (
                <p className="text-xs text-slate-500 text-center py-4">Loading projects...</p>
              ) : projects.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No active projects.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActiveProjId(p.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeProjId === p.id 
                          ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' 
                          : 'bg-slate-950 text-slate-400 hover:bg-slate-800/30 border border-slate-800'
                      }`}
                    >
                      📁 {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Create Project Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                Create Project
              </h3>
              <form onSubmit={handleCreateProject} className="flex flex-col gap-3 text-xs">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                  placeholder="App Design Phase"
                  required
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 py-1.5 rounded font-bold text-white transition-colors"
                >
                  Initialize Project Workspace
                </button>
              </form>
            </div>

            {/* AI Appraisal request form */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                AI Performance Appraisals
              </h3>
              <form onSubmit={handleSynthesizeAppraisal} className="flex flex-col gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-400 text-[10px]">EMPLOYEE USER ID</label>
                  <input
                    type="text"
                    value={appraisalUserId}
                    onChange={(e) => setAppraisalUserId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[10px]"
                    placeholder="usr_3"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="bg-violet-600 hover:bg-violet-700 py-1.5 rounded font-bold text-white transition-colors"
                >
                  🧠 Synthesize Report File via AI
                </button>
              </form>
            </div>

          </div>

          {/* Column 2 & 3: Hierarchical WBS Tree list */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            
            {/* WBS Task Tree */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                Work Breakdown Structure (WBS) Task Schedule
              </h3>

              {tasks.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-xl">
                  No tasks registered in this project yet. Use the scheduler form below to initialize the WBS tree.
                </p>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto pr-2 divide-y divide-slate-850">
                  {tasks.map((t) => (
                    <div key={t.id} className="pt-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">
                            {t.parentId ? '↳ ' : ''} {t.title}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                            t.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-950 text-slate-400 border border-slate-800'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          ID: {t.id} | Progress: {t.progress}% | Priority: {t.priority}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {t.status !== 'COMPLETED' && (
                          <button
                            onClick={() => setSelectedTaskForScorecard(t)}
                            className="bg-amber-600 hover:bg-amber-700 text-[10px] font-bold px-2 py-1 rounded transition-colors text-white"
                          >
                            Evaluate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Task Scheduler Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                WBS Task Scheduler
              </h3>

              <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-400">TASK WORK TITLE</label>
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                    placeholder="Create database layout mappings"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-400">PARENT TASK (Optional - nesting level)</label>
                  <select
                    value={newTaskParentId}
                    onChange={(e) => setNewTaskParentId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200"
                  >
                    <option value="">No Parent (Root Task)</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-400">TASK PRIORITY TIER</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-slate-200"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-400">AUTO-VERIFICATION URL CALLBACK (Optional)</label>
                  <input
                    type="url"
                    value={newTaskVerificationUrl}
                    onChange={(e) => setNewTaskVerificationUrl(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
                    placeholder="http://my-verification-api.com/status"
                  />
                </div>

                <button
                  type="submit"
                  className="md:col-span-2 bg-indigo-600 hover:bg-indigo-700 py-2 rounded font-bold transition-all text-white mt-1"
                >
                  Schedule WBS Task Node
                </button>
              </form>
            </div>

            {/* Scorecard Grading Modal Drawer */}
            {selectedTaskForScorecard && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4 text-xs">
                <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                  Evaluate scorecard: "{selectedTaskForScorecard.title}"
                </h3>

                <form onSubmit={handleScorecardSubmit} className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    {['Speed', 'Quality'].map(c => (
                      <div key={c} className="flex-1 flex flex-col gap-1">
                        <label className="font-bold text-slate-400 uppercase text-[10px]">{c} Score (1-10)</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={critScores[c] || 8}
                          onChange={(e) => setCritScores({ ...critScores, [c]: Number(e.target.value) })}
                          className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-slate-200"
                          required
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-slate-400 uppercase text-[10px]">Evaluator Remarks</label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded p-2.5 h-20 text-slate-200"
                      placeholder="Exceptional response times and clean design architecture."
                      required
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTaskForScorecard(null)}
                      className="flex-1 border border-slate-800 hover:bg-slate-950 py-2 rounded font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-2 rounded font-bold text-white"
                    >
                      Submit scorecard
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* AI report output panel */}
            {aiReport && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4 text-xs">
                <h3 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-3 uppercase tracking-wider">
                  🧠 Synthesized Appraisal Performance Appraisal
                </h3>
                <p className="whitespace-pre-line font-mono leading-relaxed text-slate-300 bg-slate-950 p-4 rounded-lg border border-slate-850 text-[11px]">
                  {aiReport}
                </p>
              </div>
            )}

          </div>

        </div>

      </div>
    </main>
  );
}
