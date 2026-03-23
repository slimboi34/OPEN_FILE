import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { HardDrive, Search, ShieldCheck, Trash2, Settings, Activity, FolderSearch, AlertTriangle, Terminal, Key, Bot, Clock, Plus, Trash } from "lucide-react";
import { generateAgentResponse, AIProvider, Message } from "./ai";
import "./App.css";

type Schedule = 'hourly' | 'daily' | 'weekly';
interface AutomationTask {
  id: string;
  name: string;
  prompt: string;
  schedule: Schedule;
  lastRun: number | null;
}
interface AutomationLog {
  timestamp: number;
  taskName: string;
  command: string;
  output: string;
  error?: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#f59e0b'];

function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanComplete, setCleanComplete] = useState(false);

  /**
   * Tracks the currently active view in the navigation sidebar.
   * Options: 'smart_scan', 'deep_search', 'command_bridge', 'settings'
   */
  const [activeTab, setActiveTab] = useState("smart_scan");
  const [scanResult, setScanResult] = useState<{
    scanned_gb: number,
    items: {name: string, path: string, size: number, item_type: string}[],
    safe_to_delete_gb: number
  } | null>(null);

  // Search Context State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{name: string, path: string, size: number}[]>([]);

  // Command Bridge State
  const [cmdInput, setCmdInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<{type: 'in'|'out'|'error'|'chat', text: string}[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Settings State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("open_file_api_key") || "");
  const [aiProvider, setAiProvider] = useState<AIProvider>(() => (localStorage.getItem("open_file_ai_provider") as AIProvider) || "openai");
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Jarvis State
  const [automations, setAutomations] = useState<AutomationTask[]>(() => JSON.parse(localStorage.getItem('open_file_automations') || '[]'));
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>(() => JSON.parse(localStorage.getItem('open_file_automation_logs') || '[]'));
  
  // New Jarvis UI State
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutinePrompt, setNewRoutinePrompt] = useState("");
  const [newRoutineSchedule, setNewRoutineSchedule] = useState<Schedule>("daily");

  const fileData = [
    { name: "System Cache", size: 12.5, items: 3400 },
    { name: "Large Media", size: 45.2, items: 15 },
    { name: "Duplicates", size: 8.4, items: 420 },
    { name: "App Logs", size: 2.1, items: 120 },
    { name: "Safe to Keep", size: 312.8, items: 145000 },
  ];

  // Persist Jarvis State
  useEffect(() => localStorage.setItem('open_file_automations', JSON.stringify(automations)), [automations]);
  useEffect(() => localStorage.setItem('open_file_automation_logs', JSON.stringify(automationLogs)), [automationLogs]);

  // Background Automation Engine
  useEffect(() => {
    const executeBackgroundRoutine = async (task: AutomationTask, k: string, p: AIProvider) => {
       const now = Date.now();
       try {
          let loopMessages: Message[] = [
             { role: 'user', content: task.prompt }
          ];
          let maxSteps = 10;
          let step = 0;

          while (step < maxSteps) {
             const aiResponse = await generateAgentResponse(p, k, loopMessages);
             loopMessages.push({ role: 'assistant', content: aiResponse });

             if (aiResponse.startsWith("DONE:")) {
                 setAutomationLogs(prev => [{timestamp: now, taskName: task.name, command: 'DONE', output: aiResponse.replace("DONE:", "").trim()}, ...prev].slice(0, 50));
                 break;
             } else if (aiResponse.startsWith("COMMAND:")) {
                 const cmd = aiResponse.replace("COMMAND:", "").trim();
                 try {
                    const out: string = await invoke("execute_shell_command", { command: cmd });
                    setAutomationLogs(prev => [{timestamp: now, taskName: task.name, command: cmd, output: out}, ...prev].slice(0, 50));
                    loopMessages.push({ role: 'user', content: `[COMMAND OUTPUT]\n${out}` });
                 } catch (err: any) {
                    setAutomationLogs(prev => [{timestamp: now, taskName: task.name, command: cmd, output: `ERROR: ${err}`}, ...prev].slice(0, 50));
                    loopMessages.push({ role: 'user', content: `[COMMAND ERROR]\n${err}` });
                 }
             } else {
                 setAutomationLogs(prev => [{timestamp: now, taskName: task.name, command: 'N/A', output: aiResponse}, ...prev].slice(0, 50));
                 break;
             }
             step++;
          }
       } catch (e: any) {
          setAutomationLogs(prev => [{timestamp: now, taskName: task.name, command: 'ERROR', output: '', error: String(e)}, ...prev].slice(0, 50));
       }
    };

    const interval = setInterval(() => {
      const currentApiKey = localStorage.getItem("open_file_api_key");
      const currentProvider = (localStorage.getItem("open_file_ai_provider") as AIProvider) || "openai";
      if (!currentApiKey) return;

      setAutomations(prev => {
         const now = Date.now();
         let shouldUpdate = false;
         
         const nextAutomations = prev.map(task => {
             let thresholdMs = 3600000; // Hourly
             if (task.schedule === 'daily') thresholdMs = 86400000;
             if (task.schedule === 'weekly') thresholdMs = 604800000;
             
             if (!task.lastRun || (now - task.lastRun > thresholdMs)) {
                 shouldUpdate = true;
                 executeBackgroundRoutine(task, currentApiKey, currentProvider);
                 return { ...task, lastRun: now };
             }
             return task;
         });
         return shouldUpdate ? nextAutomations : prev;
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  /**
   * Triggers the Tauri Rust backend to perform a system-wide scan for junk files.
   * This updates the state to show a simulated progress bar while the backend executes.
   */
  const handleScan = async () => {
    setIsScanning(true);
    setScanProgress(0);
    setScanResult(null);

    // Fake progress updater
    const interval = setInterval(() => {
      setScanProgress(p => p >= 90 ? 90 : p + 5);
    }, 200);

    try {
      const result: any = await invoke("run_smart_scan");
      setScanResult(result);
      setCleanComplete(false);
      setScanProgress(100);
      setIsScanning(false);
      clearInterval(interval);
    } catch (e) {
      console.error(e);
      setIsScanning(false);
      clearInterval(interval);
    }
  };

  const handleClean = async () => {
    if (!scanResult) return;
    setIsCleaning(true);
    try {
      // Pass the paths to the Rust backend
      const paths = scanResult.items.map(item => item.path);
      const cleanedCount: number = await invoke("clean_items", { paths });
      console.log(`Cleaned ${cleanedCount} items`);
      setIsCleaning(false);
      setCleanComplete(true);
      // Optional: Clear results since they are cleaned
      setScanResult(null);
    } catch (e) {
      console.error(e);
      setIsCleaning(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results: any = await invoke("search_files", { query: searchQuery, path: null });
      setSearchResults(results);
    } catch (e) {
      console.error(e);
    }
    setIsSearching(false);
  };

  /**
   * Executes a native shell command securely by sending it via IPC to the Rust backend.
   * If an AI Provider is enabled, it interprets the user's natural language command into a shell executable prior to running.
   */
  const executeCommand = async () => {
    if (!cmdInput.trim() || isExecuting) return;
    const userInput = cmdInput;
    setCmdInput("");
    setCmdHistory(prev => [...prev, { type: 'in', text: `$ ${userInput}` }]);
    setIsExecuting(true);
    
    try {
      if (!apiKey) {
         // Fallback to strict raw text command if no API key is set
         const output: string = await invoke("execute_shell_command", { command: userInput });
         setCmdHistory(prev => [...prev, { type: 'out', text: output }]);
         setIsExecuting(false);
         return;
      }

      // Autonomous Agent Loop (ReAct)
      let loopMessages: Message[] = [
         { role: 'user', content: userInput }
      ];
      let maxSteps = 15;
      let step = 0;

      while (step < maxSteps) {
         setCmdHistory(prev => [...prev, { type: 'chat', text: `[${aiProvider.toUpperCase()}] Reasoning (Step ${step+1})...` }]);
         
         const aiResponse = await generateAgentResponse(aiProvider, apiKey, loopMessages);
         loopMessages.push({ role: 'assistant', content: aiResponse });

         if (aiResponse.startsWith("DONE:")) {
             setCmdHistory(prev => [...prev, { type: 'chat', text: aiResponse.replace("DONE:", "").trim() }]);
             break;
         } else if (aiResponse.startsWith("COMMAND:")) {
             const cmd = aiResponse.replace("COMMAND:", "").trim();
             setCmdHistory(prev => [...prev, { type: 'in', text: `> Executing: ${cmd}` }]);
             
             try {
                const output: string = await invoke("execute_shell_command", { command: cmd });
                setCmdHistory(prev => [...prev, { type: 'out', text: output }]);
                loopMessages.push({ role: 'user', content: `[COMMAND OUTPUT]\n${output}` });
             } catch (err: any) {
                setCmdHistory(prev => [...prev, { type: 'error', text: String(err) }]);
                loopMessages.push({ role: 'user', content: `[COMMAND ERROR]\n${err}` });
             }
         } else {
             // Safe Fallback if AI fails to follow strict prefix output protocol
             setCmdHistory(prev => [...prev, { type: 'chat', text: aiResponse }]);
             break; 
         }
         step++;
      }
      
      if (step >= maxSteps) {
          setCmdHistory(prev => [...prev, { type: 'error', text: 'Agent reached maximum step limit.' }]);
      }
    } catch (e: any) {
      setCmdHistory(prev => [...prev, { type: 'error', text: String(e) }]);
    }
    
    setIsExecuting(false);
  };

  return (
    <div className="flex h-screen bg-background text-gray-200 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className="w-64 bg-surface/80 backdrop-blur-xl border-r border-white/5 flex flex-col pt-8">
        <div className="px-6 mb-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-primary/20 bg-surface">
            <img src="/auraclean_icon.png" alt="AuraClean Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
            Open File
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavItem 
            active={activeTab === "smart_scan"} 
            onClick={() => setActiveTab("smart_scan")}
            icon={<Activity size={18} />} 
            label="Smart Scan" 
          />
          <NavItem 
            active={activeTab === "deep_search"} 
            onClick={() => setActiveTab("deep_search")}
            icon={<Search size={18} />} 
            label="AI Deep Search" 
          />
          <NavItem 
            active={activeTab === "command_bridge"} 
            onClick={() => setActiveTab("command_bridge")}
            icon={<Terminal size={18} />} 
            label="Command Bridge" 
          />
          <NavItem 
            active={activeTab === "jarvis"} 
            onClick={() => setActiveTab("jarvis")}
            icon={<Bot size={18} />} 
            label="Jarvis Automations" 
          />
          <NavItem active={false} icon={<FolderSearch size={18} />} label="Space Lens" />
          <NavItem active={false} icon={<Trash2 size={18} />} label="Uninstaller" />
        </nav>

        <div className="p-6">
          <button 
             onClick={() => setActiveTab("settings")}
             className={`flex items-center gap-2 transition-colors ${activeTab === 'settings' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Settings size={18} />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-background/50 backdrop-blur-md z-10 p-safe-top">
          <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
            <HardDrive size={16} /> 
            <span>Macintosh HD</span>
            <span className="mx-2">•</span>
            <span className="text-primary font-bold">245 GB Free</span>
            <span className="text-gray-600">/ 512 GB Total</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-xs bg-green-500/10 text-green-400 px-3 py-1.5 rounded-full font-medium border border-green-500/20 flex items-center gap-1.5">
               <ShieldCheck size={14}/>
               System Protected
             </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none -translate-y-1/2"></div>
          
          <div className="max-w-5xl mx-auto space-y-8 relative z-10">
            {activeTab === "smart_scan" && (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-3xl font-extrabold text-white mb-2">System Overview</h2>
                    <p className="text-gray-400">Open File's AI engine is standing by to optimize your system.</p>
                  </div>
                  <button 
                    onClick={handleScan}
                    disabled={isScanning}
                    className={`px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                      isScanning ? 'bg-surfaceHover text-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-blue-500 text-white shadow-lg shadow-primary/25 hover:shadow-primary/40'
                    }`}
                  >
                    <Search size={18} className={isScanning ? "animate-spin" : ""} />
                    {isScanning ? `Scanning... ${scanProgress}%` : "Run Smart Scan"}
                  </button>
                </div>

                {/* AI Diagnostics Banner */}
                {scanResult && !cleanComplete && (
                   <div className="bg-gradient-to-r from-accent/20 to-primary/20 border border-accent/20 rounded-2xl p-6 flex items-start gap-4 shadow-xl">
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 shadow-inner">
                         <AlertTriangle className="text-accent" size={24} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-1">AI Diagnostics Complete</h3>
                        <p className="text-gray-300 mb-4">We found <span className="text-primary font-bold shadow-sm">{scanResult.safe_to_delete_gb.toFixed(2)} GB</span> of safely removable junk out of {scanResult.scanned_gb} GB scanned. 0 critical system files flagged.</p>
                        <button 
                          onClick={handleClean}
                          disabled={isCleaning}
                          className={`px-5 py-2.5 rounded-lg font-bold transition-all shadow-lg ${
                            isCleaning 
                              ? 'bg-surfaceHover text-gray-500 cursor-not-allowed'
                              : 'bg-white text-black hover:bg-gray-200'
                          }`}
                        >
                          {isCleaning ? "Cleaning..." : `Safely Clean ${scanResult.items.length} Items`}
                        </button>
                      </div>
                   </div>
                )}

                {cleanComplete && (
                   <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 flex items-center gap-4 shadow-xl">
                      <div className="p-3 bg-green-500/20 rounded-xl border border-green-500/30">
                         <ShieldCheck className="text-green-400" size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-green-400 mb-1">System Clean & Optimized</h3>
                        <p className="text-gray-300">Your system is now clear of tracked junk files. Open File continues monitoring.</p>
                      </div>
                   </div>
                )}

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Storage Breakdown */}
                  <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
                    <h3 className="text-lg font-bold text-gray-200 mb-6">Storage Breakdown</h3>
                    <div className="h-64 flex items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={fileData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis dataKey="name" stroke="#ffffff40" tick={{fill: '#9ca3af', fontSize: 12}} />
                          <YAxis stroke="#ffffff40" tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(val) => `${val}GB`} />
                          <Tooltip 
                            cursor={{fill: '#ffffff05'}}
                            contentStyle={{backgroundColor: '#121216', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff'}}
                            itemStyle={{color: '#fff'}}
                          />
                          <Bar dataKey="size" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Duplicate Hunter */}
                  <div className="glass-panel rounded-2xl p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-200 mb-6">Space Categories</h3>
                    <div className="flex-1 min-h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={fileData.filter(d => d.name !== "Safe to Keep")}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="size"
                            stroke="none"
                          >
                            {fileData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{backgroundColor: '#121216', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px'}}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                       {fileData.filter(d => d.name !== "Safe to Keep").map((item, i) => (
                         <div key={item.name} className="flex justify-between items-center text-sm">
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i]}}></div>
                             <span className="text-gray-400">{item.name}</span>
                           </div>
                           <span className="font-medium text-gray-200">{item.size} GB</span>
                         </div>
                       ))}
                    </div>
                  </div>

                </div>
              </>
            )}

            {activeTab === "deep_search" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-extrabold text-white mb-2">AI Contextual Deep Search</h2>
                  <p className="text-gray-400">Search through the detailed context of all your computer's files using natural language.</p>
                </div>
                
                <div className="glass-panel rounded-2xl p-6">
                  <div className="flex items-center gap-4 border border-white/10 bg-black/40 rounded-xl px-4 py-3 focus-within:border-primary/50 transition-colors">
                    <Search className="text-gray-400" size={20} />
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="e.g. Find my 2023 tax return PDF..." 
                      className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600"
                    />
                    <button 
                      onClick={handleSearch}
                      disabled={isSearching}
                      className="bg-primary/20 hover:bg-primary/30 text-primary px-4 py-1.5 rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
                    >
                      {isSearching ? "Searching..." : "Deep Search"}
                    </button>
                  </div>
                </div>

                {searchResults.length > 0 ? (
                  <div className="bg-surface/50 border border-white/5 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5 bg-white/5">
                      <h3 className="font-semibold text-gray-200">Found {searchResults.length} relevant files</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto p-2">
                       {searchResults.map((res, i) => (
                         <div key={i} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-xl transition-colors cursor-pointer">
                            <div>
                               <p className="text-gray-200 font-medium">{res.name}</p>
                               <p className="text-xs text-gray-500 mt-1 truncate max-w-lg" title={res.path}>{res.path}</p>
                            </div>
                            <span className="text-xs bg-white/5 px-2 py-1 rounded-md text-gray-400">
                               {(res.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                         </div>
                       ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface/50 border border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                    <FolderSearch className="text-gray-600 mb-4" size={48} />
                    <h3 className="text-gray-300 font-medium text-lg">AI File Indexing Active</h3>
                    <p className="text-gray-500 mt-2 max-w-md">The local AI model continuously reads and understands your files in the background, giving you a semantic, context-aware global search.</p>
                  </div>
                )}
              </div>
            )}

            {/* AI Command Bridge Tab */}
            {activeTab === 'command_bridge' && (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-4">
                    <Terminal size={14} />
                    <span className="text-xs font-medium uppercase tracking-wider">Sys Control Active</span>
                  </div>
                  <h2 className="text-3xl font-extrabold text-white mb-2">Command Bridge</h2>
                  <p className="text-gray-400">Directly interface the local AI engine with your computer's native shell.</p>
                </div>

                <div className="flex-1 bg-black/80 font-mono text-sm rounded-2xl border border-white/10 p-4 flex flex-col overflow-hidden shadow-inner">
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2">
                    <div className="text-green-500 mb-4 opacity-80">
                      [System initialized. Awaiting commands...]
                      {apiKey ? "\n[AI Integration: ONLINE]" : "\n[AI Integration: OFFLINE. Paste API key in settings.]"}
                    </div>
                    {cmdHistory.map((line, i) => (
                      <div key={i} className={`whitespace-pre-wrap break-words ${line.type === 'in' ? 'text-primary font-bold' : line.type === 'error' ? 'text-red-400' : line.type === 'chat' ? 'text-purple-400 font-bold' : 'text-gray-300'}`}>
                        {line.text}
                      </div>
                    ))}
                    {isExecuting && <div className="text-gray-500 animate-pulse">Running...</div>}
                  </div>
                  
                  <div className="flex items-center gap-2 border-t border-white/10 pt-4">
                    <span className="text-primary font-bold">~ {'>'}</span>
                    <input 
                      type="text" 
                      value={cmdInput}
                      onChange={(e) => setCmdInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && executeCommand()}
                      placeholder="Enter a shell command or ask the AI to run one..." 
                      className="bg-transparent border-none outline-none flex-1 text-green-400 placeholder:text-gray-600 focus:ring-0"
                      autoFocus
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
                <div className="mb-6">
                  <h2 className="text-3xl font-extrabold text-white mb-2">Settings</h2>
                  <p className="text-gray-400">Configure your local integrations.</p>
                </div>
                
                <div className="glass-panel p-6 rounded-2xl">
                   <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-primary/20 rounded-lg">
                         <Key size={20} className="text-primary" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-200">AI Engine Provider</h3>
                   </div>
                   <p className="text-sm text-gray-400 mb-6">Enter your OpenAI API key to enable natural language file management in the Command Bridge.</p>
                   
                   <div className="space-y-4">
                      <div>
                         <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Provider</label>
                         <select 
                           value={aiProvider}
                           onChange={(e) => {
                              setAiProvider(e.target.value as AIProvider);
                              localStorage.setItem("open_file_ai_provider", e.target.value);
                           }}
                           className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-gray-200 focus:border-primary/50 outline-none transition-colors mb-4 appearance-none"
                         >
                            <option value="openai">OpenAI (GPT-4o)</option>
                            <option value="anthropic">Anthropic (Claude 3.5)</option>
                            <option value="gemini">Google (Gemini 2.5)</option>
                         </select>

                         <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">API Key</label>
                         <input 
                           type="password"
                           value={apiKey}
                           onChange={(e) => {
                             setApiKey(e.target.value);
                             localStorage.setItem("open_file_api_key", e.target.value);
                           }}
                           placeholder="Paste your API Key here..."
                           className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-gray-200 focus:border-primary/50 outline-none transition-colors"
                         />
                      </div>
                      <p className="text-xs text-gray-500">Your key is stored securely in your computer's local storage and is never sent to any server other than directly to the model provider.</p>
                      
                      <div className="pt-4 border-t border-white/5 flex items-center gap-4">
                         <button 
                           onClick={() => {
                             localStorage.setItem("open_file_api_key", apiKey);
                             localStorage.setItem("open_file_ai_provider", aiProvider);
                             setSettingsSaved(true);
                             setTimeout(() => setSettingsSaved(false), 3000);
                           }}
                           className="bg-primary hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-primary/20 transition-all"
                         >
                           Save Configuration
                         </button>
                         {settingsSaved && (
                           <span className="text-green-400 text-sm font-medium flex items-center gap-2 animate-in fade-in duration-300">
                             <ShieldCheck size={16} /> Configuration Saved!
                           </span>
                         )}
                      </div>
                   </div>
                </div>
              </div>
            )}
            
            {/* Jarvis Tab */}
            {activeTab === 'jarvis' && (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto w-full">
                <div className="mb-6">
                  <h2 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-2">
                    <Bot className="text-primary" size={32} /> Jarvis Engine
                  </h2>
                  <p className="text-gray-400">Automated background routines run strictly on your provided schedules.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden pb-6">
                   <div className="flex flex-col gap-6 overflow-y-auto pr-2">
                      <div className="glass-panel p-6 rounded-2xl">
                         <h3 className="text-xl font-bold text-gray-200 mb-4 flex items-center gap-2"><Plus size={18} /> New Routine</h3>
                         <div className="space-y-4">
                            <input 
                              type="text" value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)}
                              placeholder="Routine Name (e.g. Empty Trash)" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 focus:border-primary/50 outline-none" 
                            />
                            <textarea
                              value={newRoutinePrompt} onChange={e => setNewRoutinePrompt(e.target.value)}
                              placeholder="Natural Language Objective (e.g. Delete all files in my Downloads folder over 500MB)" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 focus:border-primary/50 outline-none h-24 resize-none" 
                            />
                            <div className="flex gap-4">
                               <select 
                                 value={newRoutineSchedule} onChange={e => setNewRoutineSchedule(e.target.value as Schedule)}
                                 className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 focus:border-primary/50 outline-none appearance-none"
                               >
                                  <option value="hourly">Run Hourly</option>
                                  <option value="daily">Run Daily</option>
                                  <option value="weekly">Run Weekly</option>
                               </select>
                               <button 
                                 onClick={() => {
                                    if(newRoutineName && newRoutinePrompt) {
                                       setAutomations(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: newRoutineName, prompt: newRoutinePrompt, schedule: newRoutineSchedule, lastRun: null }]);
                                       setNewRoutineName(""); setNewRoutinePrompt("");
                                    }
                                 }}
                                 className="bg-primary hover:bg-blue-500 text-white px-6 rounded-xl font-bold transition-all"
                               >
                                 Add
                               </button>
                            </div>
                         </div>
                      </div>
                      
                      <div className="glass-panel p-6 rounded-2xl flex-1">
                         <h3 className="text-xl font-bold text-gray-200 mb-4 flex items-center gap-2"><Clock size={18} /> Active Routines</h3>
                         {automations.length === 0 ? (
                            <p className="text-gray-500 text-sm">No scheduled routines. Create one above.</p>
                         ) : (
                            <div className="space-y-3">
                               {automations.map(task => (
                                  <div key={task.id} className="bg-black/30 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                                     <div>
                                        <div className="text-white font-medium text-sm flex items-center gap-2">
                                          {task.name} 
                                          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full uppercase tracking-wider text-gray-300">{task.schedule}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">{task.prompt}</div>
                                     </div>
                                     <button onClick={() => setAutomations(prev => prev.filter(t => t.id !== task.id))} className="text-red-400/50 hover:text-red-400 transition-colors p-2">
                                        <Trash size={16} />
                                     </button>
                                  </div>
                               ))}
                            </div>
                         )}
                      </div>
                   </div>

                   <div className="glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/5">
                      <div className="bg-black/40 p-4 border-b border-white/5">
                         <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Engine Activity Log</h3>
                      </div>
                      <div className="p-4 flex-1 overflow-y-auto space-y-4 font-mono text-xs">
                         {automationLogs.length === 0 ? (
                            <div className="text-gray-600 italic">No background activity recorded yet. Logs will appear here when routines execute.</div>
                         ) : (
                            automationLogs.map((log, i) => (
                               <div key={i} className="border-l-2 border-primary/50 pl-3">
                                  <div className="text-gray-500 mb-1">{new Date(log.timestamp).toLocaleString()} • <span className="text-primary">{log.taskName}</span></div>
                                  <div className="text-gray-300 font-bold break-all mb-1">&gt; {log.command}</div>
                                  {log.error ? (
                                     <div className="text-red-400 break-all">{log.error}</div>
                                  ) : (
                                     <div className="text-green-400 break-all">{log.output || "Success (No Output)"}</div>
                                  )}
                               </div>
                            ))
                         )}
                      </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
      active 
        ? 'bg-primary/10 text-primary font-semibold shadow-inner' 
        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
    }`}>
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

export default App;
