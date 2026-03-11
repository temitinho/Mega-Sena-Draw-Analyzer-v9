
import * as XLSX from 'xlsx';
import { Draw, NumberStat, HistoricalMatch, AnalysisResult, SimilarityAnalysis, DrawSimilarityMatch } from '../types';

/**
 * Parses the Excel file and extracts lottery draws.
 */
export async function processExcel(file: File): Promise<Draw[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, range: 6 });
        
        const draws: Draw[] = rows
          .map((row) => {
            const id = parseInt(row[0]);
            const balls = row.slice(2, 8).map(b => parseInt(b)).filter(b => !isNaN(b)).sort((a,b) => a-b);
            if (isNaN(id) || balls.length !== 6) return null;
            return { id, balls };
          })
          .filter((d): d is Draw => d !== null);

        draws.sort((a, b) => a.id - b.id);
        resolve(draws);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Core analysis logic.
 */
export function analyzeDraws(draws: Draw[]): AnalysisResult {
  const TOTAL_NUMBERS = 60;
  const numDraws = draws.length;
  
  // 1. Calculate the Heatmap (Weights of all balls at every point in time)
  // This is needed to build the 100-interval historical distribution
  const heatmapData = new Float32Array(numDraws * TOTAL_NUMBERS);
  const frequencies = new Int32Array(TOTAL_NUMBERS + 1);
  const lastSeenAt = new Int32Array(TOTAL_NUMBERS + 1);
  lastSeenAt.fill(-1);

  const winningWeights: number[] = [];

  for (let t = 0; t < numDraws; t++) {
    const currentDraw = draws[t];
    
    // Calculate current state max values
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

    // Combined weights for this specific step
    let totalSum = 0;
    const stepProbs = new Float32Array(TOTAL_NUMBERS + 1);
    for (let n = 1; n <= TOTAL_NUMBERS; n++) {
      const p1 = maxFreq === 0 ? 0 : 1 - (frequencies[n] / maxFreq);
      const p2 = maxDelta === 0 ? 0 : deltas[n] / maxDelta;
      const combined = p1 + p2;
      stepProbs[n] = combined;
      totalSum += combined;
    }

    // Normalize and store
    for (let n = 1; n <= TOTAL_NUMBERS; n++) {
      const prob = totalSum === 0 ? 0 : (stepProbs[n] / totalSum) * 100;
      heatmapData[t * TOTAL_NUMBERS + (n - 1)] = prob;
      // If this ball was actually drawn in this step, track its winning weight
      if (currentDraw.balls.includes(n)) {
        winningWeights.push(prob);
      }
    }

    // Update state for next step
    currentDraw.balls.forEach(b => {
      frequencies[b]++;
      lastSeenAt[b] = t;
    });
  }

  // 2. Build the 100-interval histogram of historical winning weights
  const maxWinningWeight = winningWeights.length > 0 ? Math.max(...winningWeights) : 1;
  const intBinCount = 100;
  const intBinSize = maxWinningWeight / intBinCount;
  const histogram = new Array(intBinCount).fill(0);
  
  winningWeights.forEach(p => {
    let binIdx = Math.floor(p / intBinSize);
    if (binIdx >= intBinCount) binIdx = intBinCount - 1;
    histogram[binIdx]++;
  });

  // 3. Calculate weights for the NEXT draw (the actual recommendation)
  // Use final state
  let currentMaxFreq = 0;
  for (let n = 1; n <= TOTAL_NUMBERS; n++) if (frequencies[n] > currentMaxFreq) currentMaxFreq = frequencies[n];
  let currentMaxDelta = 0;
  const finalDeltas = new Int32Array(TOTAL_NUMBERS + 1);
  for (let n = 1; n <= TOTAL_NUMBERS; n++) {
    const delta = lastSeenAt[n] === -1 ? numDraws : numDraws - lastSeenAt[n];
    finalDeltas[n] = delta;
    if (delta > currentMaxDelta) currentMaxDelta = finalDeltas[n];
  }

  let finalTotalSum = 0;
  const finalWeights = new Float32Array(TOTAL_NUMBERS + 1);
  for (let n = 1; n <= TOTAL_NUMBERS; n++) {
    const p1 = currentMaxFreq === 0 ? 0 : 1 - (frequencies[n] / currentMaxFreq);
    const p2 = currentMaxDelta === 0 ? 0 : finalDeltas[n] / currentMaxDelta;
    const combined = p1 + p2;
    finalWeights[n] = combined;
    finalTotalSum += combined;
  }

  const normalizedProbs = Array.from(finalWeights).map(w => finalTotalSum === 0 ? 0 : (w / finalTotalSum) * 100);

  // 4. Calculate 'simulation_probability' list
  // Project current ball weights onto the historical winning weight histogram
  const rawProjectedWeights = new Float32Array(TOTAL_NUMBERS + 1);
  let totalProjectedSum = 0;
  for (let n = 1; n <= TOTAL_NUMBERS; n++) {
    const weight = normalizedProbs[n];
    const binIdx = Math.min(Math.floor(weight / intBinSize), intBinCount - 1);
    const historicalSuccess = histogram[binIdx] || 0;
    rawProjectedWeights[n] = historicalSuccess;
    totalProjectedSum += historicalSuccess;
  }

  // Normalize simulation_probability so it sums to 100
  const simulationProbability = Array.from(rawProjectedWeights).map(val => 
    totalProjectedSum === 0 ? (100 / TOTAL_NUMBERS) : (val / totalProjectedSum) * 100
  );

  // 5. Build final dfFinal list
  const dfFinal: NumberStat[] = [];
  for (let i = 1; i <= TOTAL_NUMBERS; i++) {
    dfFinal.push({
      number: i,
      totalPickings: frequencies[i],
      delta: finalDeltas[i],
      probability: normalizedProbs[i]
    });
  }

  const top6Probable = [...dfFinal]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 6);

  // 6. Generate Simulations
  // standard simulation uses algorithm weights (normalizedProbs)
  const simulatedDraw = mainSim(6, normalizedProbs.slice(1));
  // projected simulation uses simulationProbability
  const projectedSimulatedDraw = mainSim(6, simulationProbability.slice(1));

  // 7. Match history
  const historicalMatches: HistoricalMatch[] = draws.map(draw => {
    const intersection = draw.balls.filter(b => projectedSimulatedDraw.includes(b));
    return {
      matchCount: intersection.length,
      numbers: intersection,
      drawId: draw.id,
      allDrawn: draw.balls
    };
  })
  .filter(m => m.matchCount > 2)
  .sort((a, b) => b.matchCount - a.matchCount)
  .slice(0, 6);

  return { 
    dfFinal, 
    draws, 
    top6Probable, 
    simulatedDraw, 
    projectedSimulatedDraw, 
    historicalMatches, 
    simulationProbability 
  };
}

/**
 * Port of mainSim.
 */
function mainSim(count: number, probs: number[]): number[] {
  const chosenIndices = new Set<number>();
  const currentProbs = [...probs];
  while (chosenIndices.size < count) {
    const totalProb = currentProbs.reduce((a, b) => a + b, 0);
    if (totalProb <= 0) break; // Safety
    let r = Math.random() * totalProb;
    let index = 0;
    for (let i = 0; i < currentProbs.length; i++) {
      r -= currentProbs[i];
      if (r <= 0) {
        index = i;
        break;
      }
    }
    const ball = index + 1;
    if (!chosenIndices.has(ball)) chosenIndices.add(ball);
  }
  return Array.from(chosenIndices).sort((a, b) => a - b);
}

/**
 * Analyzes draw history for patterns of repetition and similarity.
 */
export function computeSimilarityAnalysis(draws: Draw[]): SimilarityAnalysis {
  const exactRepeats: DrawSimilarityMatch[] = [];
  const quads: DrawSimilarityMatch[] = [];
  const quinas: DrawSimilarityMatch[] = [];
  let totalComparisons = 0;

  for (let i = 0; i < draws.length; i++) {
    for (let j = i + 1; j < draws.length; j++) {
      totalComparisons++;
      const a = draws[i];
      const b = draws[j];
      
      const intersection: number[] = [];
      let pA = 0, pB = 0;
      while(pA < 6 && pB < 6) {
        if(a.balls[pA] === b.balls[pB]) {
          intersection.push(a.balls[pA]);
          pA++; pB++;
        } else if(a.balls[pA] < b.balls[pB]) {
          pA++;
        } else {
          pB++;
        }
      }

      const matchCount = intersection.length;
      if (matchCount >= 4) {
        const match: DrawSimilarityMatch = {
          drawA: a,
          drawB: b,
          matchCount,
          sharedNumbers: intersection
        };
        if (matchCount === 6) exactRepeats.push(match);
        else if (matchCount === 5) quinas.push(match);
        else if (matchCount === 4) quads.push(match);
      }
    }
  }

  return { exactRepeats, quads, quinas, totalComparisons };
}
