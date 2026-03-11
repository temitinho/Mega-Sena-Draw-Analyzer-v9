
export interface Draw {
  id: number;
  balls: number[];
  date?: string;
}

export interface NumberStat {
  number: number;
  totalPickings: number;
  delta: number; // Draws since last seen
  probability: number;
}

export interface HistoricalMatch {
  matchCount: number;
  numbers: number[];
  drawId: number;
  allDrawn: number[];
}

export interface AnalysisResult {
  dfFinal: NumberStat[];
  draws: Draw[];
  top6Probable: NumberStat[];
  simulatedDraw: number[];
  projectedSimulatedDraw: number[];
  historicalMatches: HistoricalMatch[];
  simulationProbability: number[];
}

export interface DrawSimilarityMatch {
  drawA: Draw;
  drawB: Draw;
  matchCount: number;
  sharedNumbers: number[];
}

export interface SimilarityAnalysis {
  exactRepeats: DrawSimilarityMatch[];
  quads: DrawSimilarityMatch[]; // 4 matches
  quinas: DrawSimilarityMatch[]; // 5 matches
  totalComparisons: number;
}
