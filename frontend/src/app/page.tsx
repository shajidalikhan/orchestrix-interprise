'use client';

import { useState } from 'react';

export default function Home() {
  const [projectId, setProjectId] = useState('proj_demo_123');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({
    q1: '',
    q2: '',
  });

  // Client Session States
  const [passed, setPassed] = useState<boolean | null>(null);
  const [score, setScore] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');

  // Support Chat Bot States
  const [chatInput, setChatInput] = useState('');
  const [chatLogs, setChatLogs] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    { sender: 'bot', text: 'Hello! I am your AI Support Bot. How can I help you today?' },
  ]);

  // Mock Onboarding Quiz Questions
  const quizQuestions = [
    {
      id: 'q1',
      question: 'What database mechanism is used by Orchestrix for progress rollup queries?',
      options: ['Recursive CTEs (Common Table Expressions)', 'NoSQL aggregate buckets', 'GraphQL resolvers'],
      correctAnswer: 'Recursive CTEs (Common Table Expressions)',
    },
    {
      id: 'q2',
      question: 'Which hashing standard secures integration API keys in the database?',
      options: ['MD5', 'SHA-256', 'Base64'],
      correctAnswer: 'SHA-256',
    },
  ];

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');

    if (!email || !password) {
      setFeedback('Please provide email and password');
      return;
    }

    try {
      // Direct call to our Backend Onboard API
      const res = await fetch(`http://localhost:3000/freelancers/project/${projectId}/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, answers }),
      });

      const data = await res.json();
      if (data.passed) {
        setPassed(true);
        setScore(data.score);
        setToken(data.token);
        setFeedback(data.message);
      } else {
        setPassed(false);
        setScore(data.score || '0%');
        setFeedback(data.message || 'Failed the onboarding test.');
      }
    } catch (err) {
      setFeedback('Error connecting to backend API. Please make sure the backend server is running on port 3000.');
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newLogs = [...chatLogs, { sender: 'user' as const, text: chatInput }];
    setChatLogs(newLogs);
    const query = chatInput;
    setChatInput('');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        // Fallback or development bypass headers
        headers['x-tenant-id'] = 'tenant-demo-id';
      }

      const res = await fetch(`http://localhost:3000/ai/support/project/${projectId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      setChatLogs([...newLogs, { sender: 'bot', text: data.reply }]);
    } catch (err) {
      setChatLogs([...newLogs, { sender: 'bot', text: 'Error connecting to support service.' }]);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-6 md:p-12 font-sans">
      <div className="max-w-5xl w-full flex flex-col gap-8">
        
        {/* Header Section */}
        <header className="flex flex-col gap-2 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl tracking-wider text-white shadow-lg shadow-indigo-500/30">
              O
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              Orchestrix Enterprise
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            SaaS Cross-Platform Task Planning & Performance Evaluation Portal
          </p>
        </header>

        {/* Dynamic Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Panel 1: Freelancer Assessment & Onboarding */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-6">
            <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <span className="text-indigo-400">01.</span> Freelancer Onboarding
            </h2>

            {passed === null || !passed ? (
              <form onSubmit={handleOnboardSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-400">PROJECT ID / KEY</label>
                  <input
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-400">EMAIL</label>
                    <input
                      type="email"
                      required
                      placeholder="freelancer@work.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-400">PASSWORD</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4 border-t border-slate-800 pt-4">
                  <label className="text-xs font-bold text-slate-300">PRE-REQUISITE ASSESSMENT QUIZ</label>
                  
                  {quizQuestions.map((q, idx) => (
                    <div key={q.id} className="flex flex-col gap-2 bg-slate-950/50 p-3 border border-slate-800/60 rounded-lg">
                      <p className="text-sm text-slate-300 font-medium">{idx + 1}. {q.question}</p>
                      <div className="flex flex-col gap-2 mt-1">
                        {q.options.map(option => (
                          <label key={option} className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-slate-200">
                            <input
                              type="radio"
                              name={q.id}
                              checked={answers[q.id] === option}
                              onChange={() => setAnswers({ ...answers, [q.id]: option })}
                              className="accent-indigo-500"
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5 font-semibold text-sm transition-all duration-200 shadow-md shadow-indigo-600/20 mt-2"
                >
                  Submit & Request Access
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-4 bg-emerald-950/20 border border-emerald-800/30 p-4 rounded-lg text-emerald-400">
                <p className="font-bold flex items-center gap-2">✓ Passed: {score}</p>
                <p className="text-xs text-slate-300">
                  Your JWT access token has been generated. You are now authorized as a Freelancer in project: 
                  <code className="bg-slate-950 px-2 py-0.5 rounded text-indigo-400 ml-1">{projectId}</code>
                </p>
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-[10px] text-slate-500 font-bold">TOKEN</span>
                  <div className="bg-slate-950 p-2 rounded text-[10px] break-all font-mono text-slate-400 border border-slate-800 select-all">
                    {token}
                  </div>
                </div>
              </div>
            )}

            {feedback && (
              <div className={`p-3 rounded-lg text-xs font-semibold ${passed ? 'bg-emerald-900/10 text-emerald-400' : 'bg-rose-900/10 text-rose-400'}`}>
                {feedback}
              </div>
            )}
          </div>

          {/* Panel 2: Interactive AI Support Bot Console */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col gap-4">
            <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <span className="text-violet-400">02.</span> AI Support Console
            </h2>

            <div className="flex-1 bg-slate-950 border border-slate-800/80 rounded-lg p-4 h-[320px] overflow-y-auto flex flex-col gap-3 font-sans">
              {chatLogs.map((log, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[80%] rounded-lg p-3 text-xs ${
                    log.sender === 'user'
                      ? 'bg-indigo-600/90 text-white self-end'
                      : 'bg-slate-800/60 text-slate-300 self-start border border-slate-800'
                  }`}
                >
                  <span className="font-bold text-[10px] text-slate-400 mb-1">
                    {log.sender === 'user' ? 'You' : 'Orchestrix Bot'}
                  </span>
                  <p className="leading-relaxed">{log.text}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Ask about platform or type 'I found a bug' to auto-raise ticket..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                className="bg-violet-600 hover:bg-violet-700 text-white px-4 rounded-lg font-semibold text-sm transition-all duration-200"
              >
                Send
              </button>
            </form>
          </div>

        </div>

      </div>
    </main>
  );
}
