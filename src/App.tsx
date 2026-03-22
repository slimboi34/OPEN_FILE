import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { HardDrive, Search, ShieldCheck, Trash2, Cpu, Settings, Activity, FolderSearch, AlertTriangle } from "lucide-react";
import "./App.css";

const COLORS = ['#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#f59e0b'];

function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanComplete, setCleanComplete] = useState(false);
  const [activeTab, setActiveTab] = useState("smart_scan"); // "smart_scan" or "deep_search"
  const [scanResult, setScanResult] = useState<{
    scanned_gb: number,
    items: {name: string, path: string, size: number, item_type: string}[],
    safe_to_delete_gb: number
  } | null>(null);

  const fileData = [
    { name: "System Cache", size: 12.5, items: 3400 },
    { name: "Large Media", size: 45.2, items: 15 },
    { name: "Duplicates", size: 8.4, items: 420 },
    { name: "App Logs", size: 3.1, items: 2100 },
    { name: "Safe to Keep", size: 312.8, items: 145000 },
  ];


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
          <NavItem active={false} icon={<FolderSearch size={18} />} label="Space Lens" />
          <NavItem active={false} icon={<Trash2 size={18} />} label="Uninstaller" />
        </nav>

        <div className="p-6">
          <button className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors">
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
                      placeholder="e.g. Find my 2023 tax return PDF..." 
                      className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600"
                    />
                    <button className="bg-primary/20 hover:bg-primary/30 text-primary px-4 py-1.5 rounded-lg font-medium transition-colors text-sm">
                      Deep Search
                    </button>
                  </div>
                </div>

                <div className="bg-surface/50 border border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                  <FolderSearch className="text-gray-600 mb-4" size={48} />
                  <h3 className="text-gray-300 font-medium text-lg">AI File Indexing Active</h3>
                  <p className="text-gray-500 mt-2 max-w-md">The local AI model continuously reads and understands your files in the background, giving you a semantic, context-aware global search.</p>
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
