export interface MicrostructureInput {
  ticker: string;
  volumeRatio: number;
  spreadPercent: number;
  buyPressure: number;
  openingMovePercent: number;
  intradayVolumeShelf: boolean;
}

export interface MicrostructureSignal {
  ticker: string;
  hiddenAccumulation: boolean;
  repeatBuyers: boolean;
  spreadTightening: boolean;
  liquidityVacuum: boolean;
  openingDriveAnomaly: boolean;
  volumeShelfBehavior: boolean;
  score: number;
  evidence: string[];
}

export function analyzeMicrostructure(input: MicrostructureInput): MicrostructureSignal {
  const hiddenAccumulation =
    input.buyPressure >= 64 && input.volumeRatio >= 1.8 && input.openingMovePercent < 4;
  const repeatBuyers = input.buyPressure >= 72;
  const spreadTightening = input.spreadPercent <= 1.2 && input.volumeRatio >= 1.5;
  const liquidityVacuum = input.spreadPercent >= 4 && input.volumeRatio >= 3;
  const openingDriveAnomaly = input.openingMovePercent >= 5 && input.volumeRatio >= 2.5;
  const volumeShelfBehavior = input.intradayVolumeShelf;
  const evidence = [
    hiddenAccumulation ? "Hidden accumulation" : null,
    repeatBuyers ? "Repeat buyers" : null,
    spreadTightening ? "Spread tightening" : null,
    liquidityVacuum ? "Liquidity vacuum" : null,
    openingDriveAnomaly ? "Opening drive anomaly" : null,
    volumeShelfBehavior ? "Volume shelf behavior" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    ticker: input.ticker,
    hiddenAccumulation,
    repeatBuyers,
    spreadTightening,
    liquidityVacuum,
    openingDriveAnomaly,
    volumeShelfBehavior,
    score: Math.min(100, 25 + evidence.length * 13),
    evidence,
  };
}
