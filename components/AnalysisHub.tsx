
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { X, Search, ShieldAlert, Layers, TrendingUp, MoveRight, Info, Download, Activity, BarChart3, AlignLeft, Sparkles, Target, Calculator } from 'lucide-react';
import { Draw, SimilarityAnalysis } from '../types.ts';
import Ball from './Ball.tsx';
import AIChat from './AIChat.tsx';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface AnalysisHubProps {
  draws: Draw[];
  analysis: SimilarityAnalysis;
  onClose: () => void;
}

const EvolutionMap: React.FC<{ draws: Draw[], heatmapData: Float32Array }> = ({ draws, heatmapData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ drawId: number, ball: number, prob: number } | null>(null);
  const [showFreqAnalysis, setShowFreqAnalysis] = useState(false);
  const [showProjectionHub, setShowProjectionHub] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'high-res' | 'intervals'>('intervals');

  const cellSize = 8; 
  const TOTAL_NUMBERS = 60;

  // Calculate stats for 100 Intervals
  const analysisStats = useMemo(() => {
    const winningProbs: number[] = [];
    let globalMaxProb = 0;

    draws.forEach((draw, t) => {
      draw.balls.forEach(ball => {
        const prob = heatmapData[t * TOTAL_NUMBERS + (ball - 1)];
        winningProbs.push(prob);
        if (prob > globalMaxProb) globalMaxProb = prob;
      });
    });

    const effectiveMax = globalMaxProb || 1;

    // Mode 1: High-Res (Fixed 0.1% bins)
    const hrBinSize = 0.1;
    const hrBins: Record<number, number> = {};
    winningProbs.forEach(p => {
      const binValue = Math.floor(p / hrBinSize) * hrBinSize;
      hrBins[binValue] = (hrBins[binValue] || 0) + 1;
    });
    const highResData = [];
    const maxScale = Math.ceil(effectiveMax / hrBinSize) * hrBinSize;
    for (let i = 0; i <= maxScale; i += hrBinSize) {
      const rounded = parseFloat(i.toFixed(2));
      const count = hrBins[rounded] || 0;
      highResData.push({ probVal: rounded, label: `${rounded}%`, hits: count });
    }

    // Mode 2: Exactly 100 Intervals (User requested)
    const intBinCount = 100;
    const intBinSize = effectiveMax / intBinCount;
    const bins = new Array(intBinCount).fill(0);
    
    winningProbs.forEach(p => {
      let binIdx = Math.floor(p / intBinSize);
      if (binIdx >= intBinCount) binIdx = intBinCount - 1; 
      bins[binIdx]++;
    });

    const intervalData = [];
    for (let i = 0; i < intBinCount; i++) {
      const start = i * intBinSize;
      const end = (i + 1) * intBinSize;
      intervalData.push({ 
        probVal: parseFloat(start.toFixed(4)), 
        label: `${start.toFixed(2)}% - ${end.toFixed(2)}%`, 
        hits: bins[i],
        binStart: start,
        binEnd: end
      });
    }

    return { 
      highResData, 
      intervalData,
      total: winningProbs.length,
      maxProbSeen: globalMaxProb,
      intBinSize
    };
  }, [draws, heatmapData]);

  /**
   * FUTURE PROBABILITY & SIMULATION PROBABILITY PROJECTION
   * Logic: 
   * 1. Get weights for the next draw.
   * 2. Find historical hits (Y-axis) for each weight -> future_probability.
   * 3. Scale future_probability to sum to 100 -> simulation_probability.
   */
  const projectionData = useMemo(() => {
    const lastT = draws.length - 1;
    if (lastT < 0) return [];

    // 1. Calculate future_probability list
    const future_probability: { ball: number, currentWeight: number, historicalHits: number }[] = [];
    for (let n = 1; n <= TOTAL_NUMBERS; n++) {
      const currentWeight = heatmapData[lastT * TOTAL_NUMBERS + (n - 1)];
      const binIdx = Math.min(Math.floor(currentWeight / analysisStats.intBinSize), 99);
      const hits = analysisStats.intervalData[binIdx]?.hits || 0;
      
      future_probability.push({
        ball: n,
        currentWeight,
        historicalHits: hits
      });
    }

    // 2. Calculate simulation_probability list
    const totalHistoricalHits = future_probability.reduce((sum, item) => sum + item.historicalHits, 0);
    const simulation_probability = future_probability.map(item => ({
      ...item,
      simulationValue: totalHistoricalHits === 0 
        ? (100 / TOTAL_NUMBERS) 
        : (item.historicalHits / totalHistoricalHits) * 100
    }));

    // Return sorted by simulation value for the UI
    return simulation_probability.sort((a, b) => b.simulationValue - a.simulationValue);
  }, [draws, heatmapData, analysisStats]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const numDraws = draws.length;
    canvasRef.current.width = numDraws * cellSize;
    canvasRef.current.height = TOTAL_NUMBERS * cellSize;

    ctx.fillStyle = '#030712'; 
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    for (let t = 0; t < numDraws; t++) {
      const currentDrawBalls = draws[t].balls;
      for (let n = 1; n <= TOTAL_NUMBERS; n++) {
        const prob = heatmapData[t * TOTAL_NUMBERS + (n - 1)];
        const isDrawn = currentDrawBalls.includes(n);

        if (isDrawn) {
          ctx.fillStyle = '#22c55e'; 
        } else {
          const intensity = Math.min(255, Math.floor((prob / 5) * 255)); 
          ctx.fillStyle = `rgb(${intensity}, 15, 25)`;
        }
        ctx.fillRect(t * cellSize, (TOTAL_NUMBERS - n) * cellSize, cellSize - 0.5, cellSize - 0.5);
      }
    }
  }, [draws, heatmapData]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scrollLeft = containerRef.current.scrollLeft;
    const scrolledX = x + scrollLeft;

    const t = Math.floor(scrolledX / cellSize);
    const n = TOTAL_NUMBERS - Math.floor(y / cellSize);

    if (t >= 0 && t < draws.length && n >= 1 && n <= TOTAL_NUMBERS) {
      setHoverInfo({
        drawId: draws[t].id,
        ball: n,
        prob: heatmapData[t * TOTAL_NUMBERS + (n - 1)]
      });
    } else {
      setHoverInfo(null);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `lottery-evolution-map-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="space-y-4 relative">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter flex items-center gap-2">
              <TrendingUp className="text-red-600 w-6 h-6" /> Probabilistic Evolution Timeline
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={handleDownload}
                className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-all border border-indigo-100 group shadow-sm"
                title="Download Map as Image"
              >
                <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <button 
                onClick={() => setShowFreqAnalysis(!showFreqAnalysis)}
                className={`p-2 rounded-lg transition-all border group shadow-sm flex items-center gap-2 ${showFreqAnalysis ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'}`}
                title="Frequency Analysis"
              >
                <Activity className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Statistical Intervals</span>
              </button>
              <button 
                onClick={() => setShowProjectionHub(!showProjectionHub)}
                className={`p-2 rounded-lg transition-all border group shadow-sm flex items-center gap-2 ${showProjectionHub ? 'bg-indigo-900 text-white border-indigo-900' : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'}`}
                title="Future Projection List"
              >
                <Target className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Projection Analytics</span>
              </button>
            </div>
          </div>
          <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Drawn</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-600 rounded-sm"></div> High Prob</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-950 rounded-sm"></div> Low Prob</div>
          </div>
        </div>

        <div className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-center min-h-[64px] transition-all">
          {hoverInfo ? (
            <div className="flex items-center gap-8 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Draw Sequence</span>
                <span className="text-lg font-black italic text-gray-900"># {hoverInfo.drawId}</span>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Ball Number</span>
                <span className="text-lg font-black text-indigo-600">{String(hoverInfo.ball).padStart(2, '0')}</span>
              </div>
              <div className="w-px h-8 bg-gray-200" />
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Prob. Weight</span>
                <span className="text-lg font-black text-red-600">{hoverInfo.prob.toFixed(3)}%</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] italic">
              <Info className="w-4 h-4" /> Hover map to explore data points
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <div 
          ref={containerRef}
          className="relative bg-gray-950 rounded-none border border-gray-800 shadow-2xl overflow-x-auto overflow-y-hidden cursor-crosshair group h-[500px]"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
        >
          <canvas ref={canvasRef} className="block" />
          
          <div className="absolute bottom-4 right-4 text-white/5 font-black italic pointer-events-none group-hover:text-white/20 transition-colors uppercase tracking-[0.4em] text-[9px]">
            Horizontal History: Scroll to explore full sequence
          </div>
        </div>

        {/* PROJECTION ANALYTICS OVERLAY (Future & Simulation Probability) */}
        {showProjectionHub && (
          <div className="absolute inset-0 bg-white/98 backdrop-blur-xl z-50 p-8 flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic flex items-center gap-3">
                  <Calculator className="text-indigo-900 w-6 h-6" /> Projection <span className="text-indigo-900">Hub</span>
                </h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Weight Projection & Simulation Distribution (Sum = 100%)</p>
              </div>
              <button 
                onClick={() => setShowProjectionHub(false)}
                className="p-3 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-2xl transition-all shadow-sm border border-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-4 scrollbar-hide">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {projectionData.map((item, idx) => (
                  <div key={item.ball} className={`p-5 rounded-3xl border flex flex-col items-center text-center transition-all hover:scale-105 shadow-sm ${idx < 6 ? 'bg-indigo-900 text-white border-indigo-950 ring-4 ring-indigo-100' : 'bg-white border-gray-100'}`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest mb-3 ${idx < 6 ? 'text-indigo-300' : 'text-gray-400'}`}>Rank #{idx + 1}</span>
                    <Ball number={item.ball} size="sm" highlight={idx < 6} />
                    
                    <div className="mt-5 space-y-3 w-full">
                      <div className="flex flex-col items-center">
                        <span className={`text-[8px] font-black uppercase tracking-widest ${idx < 6 ? 'text-indigo-400' : 'text-gray-400'}`}>Future Probability</span>
                        <span className={`text-sm font-black ${idx < 6 ? 'text-white' : 'text-gray-900'}`}>{item.historicalHits} Hits</span>
                      </div>
                      <div className={`w-full h-px ${idx < 6 ? 'bg-white/10' : 'bg-gray-100'}`} />
                      <div className="flex flex-col items-center">
                        <span className={`text-[8px] font-black uppercase tracking-widest ${idx < 6 ? 'text-green-400' : 'text-indigo-600'}`}>Sim. Distribution</span>
                        <span className={`text-xl font-black ${idx < 6 ? 'text-green-400' : 'text-indigo-700'}`}>{item.simulationValue.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-indigo-900 uppercase tracking-widest">Statistical Normalization</p>
                  <p className="text-[9px] font-bold text-indigo-600 uppercase italic">Sum of all 60 Simulation Probabilities = 100.00%</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Contextual Data Layer</span>
                <p className="text-lg font-black text-indigo-900 italic">Projected Success Matrix</p>
              </div>
            </div>
          </div>
        )}

        {showFreqAnalysis && (
          <div className="absolute inset-0 bg-white/98 backdrop-blur-xl z-30 p-8 flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div>
                <h4 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic flex items-center gap-3">
                  <Activity className="text-indigo-600 w-6 h-6" /> Winning Probability <span className="text-indigo-600">Distribution</span>
                </h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Weight Value Intervals (X) vs. Hit Frequency (Y)</p>
              </div>
              <div className="flex items-center bg-gray-100 p-1.5 rounded-2xl border border-gray-200 gap-1 self-start md:self-center">
                <button 
                  onClick={() => setAnalysisMode('intervals')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${analysisMode === 'intervals' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <AlignLeft className="w-3.5 h-3.5" /> 100 Intervals
                </button>
                <button 
                  onClick={() => setAnalysisMode('high-res')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${analysisMode === 'high-res' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <BarChart3 className="w-3.5 h-3.5" /> High-Res
                </button>
              </div>
              <button 
                onClick={() => setShowFreqAnalysis(false)}
                className="p-3 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-2xl transition-all shadow-sm border border-gray-100 absolute top-8 right-8"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 bg-gray-50 rounded-[2.5rem] border border-gray-100 p-8 flex flex-col min-h-0">
              <div className="flex-1 min-h-0 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={analysisMode === 'intervals' ? analysisStats.intervalData : analysisStats.highResData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey={analysisMode === 'intervals' ? 'label' : 'probVal'} 
                      tick={analysisMode === 'intervals' ? false : { fontSize: 9, fontWeight: 700, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      label={{ 
                        value: analysisMode === 'intervals' ? 'Probability Scale (100 Intervals)' : 'Probability (%)', 
                        position: 'insideBottom', offset: -10, fontSize: 10, fontWeight: 900, fill: '#6366f1' 
                      }}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'Historical Hits', angle: -90, position: 'insideLeft', fontSize: 10, fontWeight: 900, fill: '#6366f1' }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                      formatter={(value: number) => [`${value} Balls Drawn`, 'Frequency']}
                      labelFormatter={(label) => analysisMode === 'intervals' ? `Range: ${label}` : `Weight: ${label}%`}
                      contentStyle={{ 
                        borderRadius: '20px', 
                        border: 'none', 
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', 
                        fontWeight: 800,
                        fontSize: '12px',
                        padding: '16px'
                      }} 
                    />
                    <Bar dataKey="hits" radius={[4, 4, 0, 0]}>
                      {(analysisMode === 'intervals' ? analysisStats.intervalData : analysisStats.highResData).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={'#6366f1'} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <TrendingUp className="text-indigo-600 w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Max Algorithmic Weight</span>
                    <span className="text-xl font-black text-gray-900">{analysisStats.maxProbSeen.toFixed(3)}%</span>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center">
                    <Layers className="text-green-600 w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Highest Success Range</span>
                    <span className="text-xl font-black text-gray-900">
                      {analysisStats.intervalData.reduce((prev, current) => (prev.hits > current.hits) ? prev : current).label}
                    </span>
                  </div>
                </div>
                <div className="bg-indigo-900 p-5 rounded-3xl shadow-lg flex items-center gap-4 text-white">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                    <Info className="text-indigo-300 w-5 h-5" />
                  </div>
                  <p className="text-[11px] font-medium leading-tight opacity-90 italic">
                    The vertical axis accurately tracks total historical hit occurrences for each probability weight bucket.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] italic px-2">
        <div className="flex items-center gap-2"><MoveRight className="w-3 h-3"/> Chronological Order (Left to Right)</div>
        <div className="text-right">Vertical Axis: Ball Spectrum (1-60 Squares)</div>
      </div>
    </div>
  );
};

const AnalysisHub: React.FC<AnalysisHubProps> = ({ draws, analysis, onClose }) => {
  const [activeTab, setActiveTab] = useState<'patterns' | 'timeline' | 'ai'>('timeline');

  // Heatmap data calculation logic
  const heatmapData = useMemo(() => {
    const numDraws = draws.length;
    const TOTAL_NUMBERS = 60;
    const data = new Float32Array(numDraws * TOTAL_NUMBERS);
    
    const frequencies = new Int32Array(TOTAL_NUMBERS + 1);
    const lastSeenAt = new Int32Array(TOTAL_NUMBERS + 1);
    lastSeenAt.fill(-1);

    for (let t = 0; t < numDraws; t++) {
      const currentDraw = draws[t];
      
      let maxFreq = 0;
      for (let n = 1; n <= TOTAL_NUMBERS; n++) {
        if (frequencies[n] > maxFreq) maxFreq = frequencies[n];
      }

      let maxDelta = 0;
      const deltas = new Int32Array(TOTAL_NUMBERS + 1);
      for (let n = 1; n <= TOTAL_NUMBERS; n++) {
        const delta = lastSeenAt[n] === -1 ? t : t - lastSeenAt[n];
        deltas[n] = delta;
        if (delta > maxDelta) maxDelta = delta;
      }

      let totalSum = 0;
      const stepProbs = new Float32Array(TOTAL_NUMBERS + 1);
      for (let n = 1; n <= TOTAL_NUMBERS; n++) {
        const p1 = maxFreq === 0 ? 0 : 1 - (frequencies[n] / maxFreq);
        const p2 = maxDelta === 0 ? 0 : deltas[n] / maxDelta;
        const combined = p1 + p2;
        stepProbs[n] = combined;
        totalSum += combined;
      }

      for (let n = 1; n <= TOTAL_NUMBERS; n++) {
        data[t * TOTAL_NUMBERS + (n - 1)] = totalSum === 0 ? 0 : (stepProbs[n] / totalSum) * 100;
      }

      currentDraw.balls.forEach(b => {
        frequencies[b]++;
        lastSeenAt[b] = t;
      });
    }
    return data;
  }, [draws]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-2xl animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative w-full max-w-6xl max-h-[95vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        
        <div className="flex items-center justify-between p-8 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase italic flex items-center gap-3">
              <Search className="text-indigo-600 w-8 h-8" /> Data <span className="text-indigo-600">Intelligence</span>
            </h2>
            <div className="flex gap-4 mt-3">
              <button 
                onClick={() => setActiveTab('timeline')}
                className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${activeTab === 'timeline' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-gray-400 hover:text-gray-600'}`}
              >
                Evolution Map
              </button>
              <button 
                onClick={() => setActiveTab('patterns')}
                className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${activeTab === 'patterns' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-gray-400 hover:text-gray-600'}`}
              >
                Similarity Analysis
              </button>
              <button 
                onClick={() => setActiveTab('ai')}
                className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all flex items-center gap-2 ${activeTab === 'ai' ? 'bg-indigo-900 text-white shadow-lg shadow-indigo-900/20 animate-pulse' : 'bg-indigo-50 text-indigo-400 hover:text-indigo-600'}`}
              >
                <Sparkles className="w-3 h-3" /> AI Assistant
              </button>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-2xl shadow-sm border border-gray-100 transition-all active:scale-95"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/20">
          
          {activeTab === 'timeline' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <EvolutionMap draws={draws} heatmapData={heatmapData} />
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AIChat draws={draws} heatmapData={heatmapData} />
            </div>
          )}

          {activeTab === 'patterns' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-red-50 rounded-[2rem] border border-red-100 flex flex-col items-center text-center">
                  <div className="flex items-center justify-between w-full mb-4">
                    <span className="text-xs font-black text-red-600 uppercase tracking-widest">Exact Repeats (6/6)</span>
                    <ShieldAlert className="w-6 h-6 text-red-400" />
                  </div>
                  <p className="text-6xl font-black text-red-700">{analysis.exactRepeats.length}</p>
                  <p className="text-[10px] text-red-500 font-bold uppercase mt-4 tracking-[0.2em]">Identical Sequences Found</p>
                </div>
                <div className="p-8 bg-indigo-50 rounded-[2rem] border border-indigo-100 flex flex-col items-center text-center">
                  <div className="flex items-center justify-between w-full mb-4">
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">Quinas (5/6)</span>
                    <Layers className="w-6 h-6 text-indigo-400" />
                  </div>
                  <p className="text-6xl font-black text-indigo-700">{analysis.quinas.length}</p>
                  <p className="text-[10px] text-indigo-500 font-bold uppercase mt-4 tracking-[0.2em]">High-Similarity Overlaps</p>
                </div>
              </div>

              {analysis.exactRepeats.length > 0 && (
                <section>
                  <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter mb-6 flex items-center gap-2">
                    <ShieldAlert className="text-red-600 w-6 h-6" /> Detected Exact Repeats
                  </h3>
                  <div className="grid gap-4">
                    {analysis.exactRepeats.map((match, idx) => (
                      <div key={idx} className="p-6 bg-white border-2 border-red-200 rounded-3xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Original</span>
                            <p className="text-2xl font-black text-gray-900">#{match.drawA.id}</p>
                          </div>
                          <div className="w-px h-12 bg-gray-100" />
                          <div className="text-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Repeat</span>
                            <p className="text-2xl font-black text-gray-900">#{match.drawB.id}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {match.sharedNumbers.map(n => <Ball key={n} number={n} size="md" highlight />)}
                        </div>
                        <div className="px-6 py-2 bg-red-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-red-100 uppercase tracking-widest">
                          CRITICAL MATCH
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-xl font-black text-gray-900 uppercase italic tracking-tighter mb-6 flex items-center gap-2">
                  <Layers className="text-indigo-600 w-6 h-6" /> Significant Intersections (5 Identical Balls)
                </h3>
                <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Draw Reference</th>
                        <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Score</th>
                        <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Intercepted Numbers</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {analysis.quinas.map((match, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition-all">
                          <td className="px-10 py-6">
                            <div className="flex items-center gap-3 font-black text-gray-900 text-lg">
                              <span className="text-gray-400 text-xs">#</span>{match.drawA.id}
                              <span className="text-indigo-300 text-xl">↔</span>
                              <span className="text-gray-400 text-xs">#</span>{match.drawB.id}
                            </div>
                          </td>
                          <td className="px-10 py-6">
                            <span className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-100">
                              5 BALLS
                            </span>
                          </td>
                          <td className="px-10 py-6">
                            <div className="flex gap-2">
                              {match.sharedNumbers.map(n => <Ball key={n} number={n} size="sm" highlight />)}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {analysis.quinas.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-10 py-24 text-center text-gray-400 font-bold uppercase tracking-widest">No 5-ball matches detected</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

        </div>

        <div className="p-8 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase italic">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Intelligence Mode: High-Resolution Pattern Recognition
          </div>
          <span className="text-indigo-600 opacity-60">Mega-Sena Draw Analytics Hub v7.0 Statistical Projection Layer</span>
        </div>
      </div>
    </div>
  );
};

export default AnalysisHub;
