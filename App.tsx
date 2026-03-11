
import React, { useState, useMemo } from 'react';
import { LayoutDashboard, FileSpreadsheet, History, Dice6, TrendingUp, Info, FileText, Zap, ShieldAlert, Layers, Target, UploadCloud, Calculator } from 'lucide-react';
import { processExcel, analyzeDraws, computeSimilarityAnalysis } from './utils/lotteryLogic.ts';
import { AnalysisResult, NumberStat, SimilarityAnalysis } from './types.ts';
import StatsCard from './components/StatsCard.tsx';
import Ball from './components/Ball.tsx';
import AnalysisHub from './components/AnalysisHub.tsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';

/**
 * Visual distribution graph showing 60 numbers sorted by probability.
 */
const ProbabilityDistributionMap: React.FC<{ 
  stats: NumberStat[], 
  simulated: number[] 
}> = ({ stats, simulated }) => {
  const sortedStats = useMemo(() => 
    [...stats].sort((a, b) => a.probability - b.probability), 
    [stats]
  );

  return (
    <div className="w-full mt-6">
      <div className="h-12 w-full bg-gray-800/50 rounded-xl flex overflow-hidden border border-gray-700/50 shadow-inner">
        {sortedStats.map((s, idx) => {
          const isSimulated = simulated.includes(s.number);
          const intensity = (idx / 59) * 100;
          return (
            <div 
              key={s.number} 
              className="flex-1 h-full transition-all duration-500 relative group"
              style={{ 
                backgroundColor: isSimulated 
                  ? '#10b981' 
                  : `rgba(99, 102, 241, ${0.05 + (intensity / 100) * 0.3})`
              }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[8px] rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 whitespace-nowrap font-black">
                Ball {s.number}: {s.probability.toFixed(2)}%
              </div>
              {isSimulated && (
                <div className="absolute inset-0 bg-emerald-400 blur-[4px] opacity-30"></div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[8px] uppercase tracking-[0.2em] text-indigo-300 font-black opacity-40">
        <span>Min. Probability</span>
        <span>Distribution Signature Index</span>
        <span>Max. Probability</span>
      </div>
    </div>
  );
};

/**
 * Historical Intercept Component for the Dashboard Panels
 */
const InterceptList: React.FC<{ matches: any[] }> = ({ matches }) => {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 opacity-30">
        <Target className="w-6 h-6 mb-2" />
        <p className="text-[10px] font-black uppercase tracking-widest">No Matches Above 3 Hits</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.slice(0, 3).map((match, i) => (
        <div key={i} className={`flex items-center justify-between p-3 rounded-2xl border ${match.matchCount === 6 ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-black italic text-white/80">#{match.drawId}</span>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex gap-1">
              {match.shared.map((num: number) => (
                <span key={num} className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-500/40 text-[8px] font-black text-white">{num}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
             <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${match.matchCount === 6 ? 'bg-red-600 text-white' : 'bg-indigo-600/60 text-indigo-100'}`}>
               {match.matchCount === 6 ? 'EXACT REPEAT' : `${match.matchCount} HITS`}
             </span>
          </div>
        </div>
      ))}
      {matches.length > 3 && (
        <div className="text-center">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest italic">+{matches.length - 3} other historical intersections</span>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [similarity, setSimilarity] = useState<SimilarityAnalysis | null>(null);
  const [showHub, setShowHub] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    setError(null);
    setSimilarity(null);
    
    try {
      const draws = await processExcel(file);
      const analysis = analyzeDraws(draws);
      setResult(analysis);
      const simResults = computeSimilarityAnalysis(draws);
      setSimilarity(simResults);
    } catch (err) {
      console.error(err);
      setError("Failed to process file. Please ensure it is a valid Excel file with the expected draw history format.");
      setFileName(null);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.dfFinal.map(s => ({
      number: s.number,
      frequency: s.totalPickings,
      delta: s.delta,
      probability: s.probability
    }));
  }, [result]);

  // Calculate similarity for Projection Simulator
  const projectedSimilarity = useMemo(() => {
    if (!result || !result.projectedSimulatedDraw) return [];
    const sim = result.projectedSimulatedDraw;
    return result.draws.map(draw => {
      const intersection = draw.balls.filter(b => sim.includes(b));
      return { drawId: draw.id, matchCount: intersection.length, shared: intersection };
    }).filter(m => m.matchCount >= 4).sort((a, b) => b.matchCount - a.matchCount);
  }, [result]);

  // Calculate similarity for Algorithm Simulator
  const algorithmSimilarity = useMemo(() => {
    if (!result || !result.simulatedDraw) return [];
    const sim = result.simulatedDraw;
    return result.draws.map(draw => {
      const intersection = draw.balls.filter(b => sim.includes(b));
      return { drawId: draw.id, matchCount: intersection.length, shared: intersection };
    }).filter(m => m.matchCount >= 4).sort((a, b) => b.matchCount - a.matchCount);
  }, [result]);

  const handleResimulate = () => {
    if (result) {
      setResult(analyzeDraws(result.draws));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-indigo-200 shadow-lg">
              <Dice6 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-black text-gray-900 hidden sm:block tracking-tight italic">MEGA-SENA <span className="text-indigo-600">AI</span></h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {result && similarity && (
              <button 
                onClick={() => setShowHub(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full transition-all border border-indigo-100 font-bold text-xs uppercase tracking-tight shadow-sm"
              >
                <Zap className="w-4 h-4" />
                <span>Pattern Deep-Dive</span>
              </button>
            )}
            <label className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full cursor-pointer transition-all shadow-md active:scale-95">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wide">Analyze File</span>
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!result && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border-4 border-dashed border-indigo-50 shadow-sm">
            <div className="bg-indigo-50 p-10 rounded-full mb-8 animate-pulse">
              <FileSpreadsheet className="w-20 h-20 text-indigo-600" />
            </div>
            <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Intelligence Ready</h2>
            <p className="text-gray-500 text-center max-w-sm px-6 font-medium mb-10 text-lg leading-relaxed">
              Upload a draw history file to generate dual-mode simulations and pattern analysis.
            </p>
            <label className="flex items-center space-x-4 px-12 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] cursor-pointer transition-all shadow-2xl shadow-indigo-200 active:scale-95 group">
              <UploadCloud className="w-8 h-8 group-hover:translate-y-[-2px] transition-transform" />
              <div className="flex flex-col items-start">
                <span className="text-xl font-black uppercase tracking-widest leading-none">Upload History</span>
                <span className="text-[10px] font-bold opacity-70 uppercase mt-1">Select Excel or CSV File</span>
              </div>
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
            </label>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="relative">
              <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-indigo-600 mb-8"></div>
              <Dice6 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-indigo-600 animate-bounce" />
            </div>
            <p className="text-gray-900 font-black text-xl tracking-tighter uppercase">Computing Probabilities...</p>
            <p className="text-gray-400 text-sm mt-2 font-bold">{fileName}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-2 border-red-100 p-6 rounded-3xl text-red-700 mb-8 flex items-center space-x-4 shadow-sm">
            <Info className="w-8 h-8 text-red-400" />
            <div className="font-bold">{error}</div>
          </div>
        )}

        {result && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <StatsCard label="Source Data" value={fileName || "Generic"} icon={<FileText className="w-6 h-6" />} />
              <StatsCard label="History Depth" value={`${result.draws.length} Draws`} icon={<LayoutDashboard className="w-6 h-6" />} />
              <StatsCard label="Last Sequence" value={`#${result.draws[result.draws.length - 1].id}`} icon={<TrendingUp className="w-6 h-6" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              {/* PROJECTION SIMULATOR (Driven by Simulation Probability) */}
              <div className="bg-gray-900 p-10 rounded-[3rem] shadow-2xl border border-gray-800 text-white relative overflow-hidden flex flex-col group/card transition-all hover:ring-2 hover:ring-emerald-500/20">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 blur-[80px]"></div>
                
                <div className="mb-10 relative z-10 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter uppercase italic flex items-center gap-3">
                      <Calculator className="text-emerald-400 w-8 h-8" /> Projection <span className="text-emerald-300">Simulator</span>
                    </h3>
                    <p className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mt-1">Driven by Historical Hit Success Distribution</p>
                  </div>
                  <button 
                    onClick={handleResimulate}
                    className="text-[10px] font-black px-6 py-2.5 bg-emerald-600 hover:bg-white hover:text-emerald-900 rounded-full uppercase transition-all shadow-lg active:scale-95"
                  >
                    Resimulate
                  </button>
                </div>

                <div className="flex flex-wrap gap-5 mb-10 justify-center relative z-10">
                  {result.projectedSimulatedDraw.map(n => (
                    <div key={n} className="flex flex-col items-center">
                        <Ball number={n} size="lg" highlight />
                        <span className="mt-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-900/40 px-2 py-0.5 rounded-full border border-emerald-800/50">
                            {result.simulationProbability[n]?.toFixed(2)}%
                        </span>
                    </div>
                  ))}
                </div>

                {/* Historical Intercept for Projection */}
                <div className="bg-emerald-950/20 rounded-3xl border border-emerald-800/30 p-6 mb-8 relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <History className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Historical Intercept Integrity</span>
                  </div>
                  <InterceptList matches={projectedSimilarity} />
                </div>

                <div className="mt-auto">
                    <p className="text-[11px] text-emerald-200/50 font-medium italic mb-6 leading-relaxed">
                        This simulator prioritizes ball weights that land within the most successful historical 'hit zones' (the Winning Probability Distribution peaks).
                    </p>
                    <ProbabilityDistributionMap 
                        stats={result.dfFinal.map(s => ({ ...s, probability: result.simulationProbability[s.number] || 0 }))} 
                        simulated={result.projectedSimulatedDraw} 
                    />
                </div>
              </div>

              {/* ALGORITHM SIMULATOR (Probability Simulation) */}
              <div className="bg-indigo-950 p-10 rounded-[3rem] shadow-2xl border border-indigo-800 text-white relative overflow-hidden flex flex-col group/card transition-all hover:ring-2 hover:ring-indigo-500/20">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 blur-[80px]"></div>
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter uppercase italic flex items-center gap-3">
                        <Dice6 className="text-indigo-400 w-8 h-8" /> Algorithm <span className="text-indigo-300">Simulator</span>
                    </h3>
                    <p className="text-[9px] font-black text-indigo-400/60 uppercase tracking-widest mt-1">Driven by Pure Algorithmic Scarcity Weights</p>
                  </div>
                  <button 
                    onClick={handleResimulate}
                    className="text-[10px] font-black px-6 py-2.5 bg-indigo-600 hover:bg-white hover:text-indigo-900 rounded-full uppercase transition-all shadow-lg active:scale-95"
                  >
                    Resimulate
                  </button>
                </div>

                <div className="flex flex-wrap gap-5 mb-10 justify-center">
                  {result.simulatedDraw.map(n => (
                    <div key={n} className="flex flex-col items-center">
                        <Ball number={n} size="lg" />
                        <span className="mt-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-900/40 px-2 py-0.5 rounded-full border border-indigo-800/50">
                            {result.dfFinal.find(s => s.number === n)?.probability.toFixed(2)}%
                        </span>
                    </div>
                  ))}
                </div>
                
                {/* Historical Intercept for Algorithm */}
                <div className="bg-indigo-900/40 rounded-3xl border border-indigo-700/50 p-6 mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <History className="w-4 h-4 text-indigo-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Historical Intercept Integrity</span>
                  </div>
                  <InterceptList matches={algorithmSimilarity} />
                </div>

                <div className="mt-auto">
                    <p className="text-[11px] text-indigo-200/50 font-medium italic mb-6 leading-relaxed">
                        This simulator operates on the raw algorithmic weight distribution, prioritizing numbers based on frequency gaps and historical absence sequences.
                    </p>
                    <ProbabilityDistributionMap stats={result.dfFinal} simulated={result.simulatedDraw} />
                </div>
              </div>
            </div>

            {/* FULL INTERCEPT TABLE */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-10 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-white to-gray-50">
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic flex items-center gap-3">
                  <History className="text-indigo-600 w-8 h-8" /> Global <span className="text-indigo-600">Intercepts</span>
                </h3>
                <span className="text-sm font-bold text-gray-400 bg-gray-100 px-4 py-1 rounded-full uppercase tracking-tighter">Top Historical Success Clusters</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Draw ID</th>
                      <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Intercept Score</th>
                      <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Matching Balls</th>
                      <th className="px-10 py-6 text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Full Sequence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.historicalMatches.map((m, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30 transition-all cursor-default">
                        <td className="px-10 py-6 font-black text-gray-900 text-xl tracking-tighter">#{m.drawId}</td>
                        <td className="px-10 py-6">
                          <div className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-xs font-black ${m.matchCount >= 5 ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' : 'bg-gray-900 text-white'}`}>
                            {m.matchCount} HITS
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex gap-2">
                            {m.numbers.map(n => (
                              <Ball key={n} number={n} size="sm" highlight />
                            ))}
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex gap-1.5 opacity-30 hover:opacity-100 transition-all">
                            {m.allDrawn.map(n => (
                              <Ball key={n} number={n} size="sm" />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-100">
                <h3 className="text-xl font-black text-gray-900 mb-8 uppercase italic tracking-tighter">Frequency Profile</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 800 }} />
                      <Bar dataKey="frequency" fill="#6366f1" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={result.top6Probable.some(t => t.number === entry.number) ? '#f59e0b' : '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-100">
                <h3 className="text-xl font-black text-gray-900 mb-8 uppercase italic tracking-tighter">Gap Intelligence Matrix</h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis type="number" dataKey="delta" name="Time Gap" unit=" drw" axisLine={false} tickLine={false} />
                      <YAxis type="number" dataKey="probability" name="Weight" unit="%" axisLine={false} tickLine={false} />
                      <ZAxis type="number" range={[100, 600]} />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter name="Ball Data" data={chartData}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={result.top6Probable.some(t => t.number === entry.number) ? '#ef4444' : '#6366f1'} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-10 border-b border-gray-100">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic">Computed <span className="text-indigo-600">Statistical Index</span></h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 p-10 bg-gray-50/30">
                    {result.dfFinal.map(s => (
                        <div key={s.number} className={`p-5 rounded-3xl border-2 transition-all group ${result.top6Probable.some(t => t.number === s.number) ? 'bg-indigo-600 border-indigo-400 shadow-xl shadow-indigo-100 scale-105' : 'bg-white border-gray-100 hover:border-indigo-200'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <span className={`text-2xl font-black ${result.top6Probable.some(t => t.number === s.number) ? 'text-white' : 'text-gray-900'}`}>#{s.number}</span>
                                {result.top6Probable.some(t => t.number === s.number) && <TrendingUp className="w-5 h-5 text-white animate-pulse" />}
                            </div>
                            <div className="space-y-2">
                                <div className={`flex justify-between text-[10px] font-black ${result.top6Probable.some(t => t.number === s.number) ? 'text-indigo-200' : 'text-gray-400'}`}>
                                    <span>WEIGHT:</span>
                                    <span className={result.top6Probable.some(t => t.number === s.number) ? 'text-white' : 'text-gray-900'}>{s.probability.toFixed(2)}%</span>
                                </div>
                                <div className={`flex justify-between text-[10px] font-black ${result.top6Probable.some(t => t.number === s.number) ? 'text-indigo-200' : 'text-gray-400'}`}>
                                    <span>FREQ:</span>
                                    <span className={result.top6Probable.some(t => t.number === s.number) ? 'text-white' : 'text-gray-900'}>{s.totalPickings}</span>
                                </div>
                                <div className={`flex justify-between text-[10px] font-black ${result.top6Probable.some(t => t.number === s.number) ? 'text-indigo-200' : 'text-gray-400'}`}>
                                    <span>DELTA:</span>
                                    <span className={result.top6Probable.some(t => t.number === s.number) ? 'text-white' : 'text-gray-900'}>{s.delta}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        )}
      </main>

      {/* Analysis Hub Overlay */}
      {showHub && similarity && result && (
        <AnalysisHub 
          draws={result.draws} 
          analysis={similarity} 
          onClose={() => setShowHub(false)} 
        />
      )}

      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 py-4 z-20 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase italic">
          <span className="flex items-center gap-2"><Dice6 className="w-3 h-3 text-indigo-500" /> Intelligence Layer Active</span>
          <span className="hidden sm:inline">Dual Simulation Engine v8.0</span>
          <span className="text-indigo-600">Historical Hits Projection Optimized</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
