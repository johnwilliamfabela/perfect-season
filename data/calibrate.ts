/* Calibration: across random 5-team draws, how strong is the best affordable
   squad and what are its perfect-season odds? Run: npx tsx data/calibrate.ts */
import { TEAMS } from "../src/game/data";
import { bestPossible, simSeason } from "../src/game/sim";

function draw5(): string[] {
  const names = TEAMS.map((t) => t.name);
  const out: string[] = [];
  for (let i = 0; i < 5; i++) out.push(names[Math.floor(Math.random() * names.length)]);
  return out;
}

function perfectPct(off: number, n = 4000): number {
  let c = 0;
  for (let i = 0; i < n; i++) if (simSeason(off).perfect) c++;
  return (100 * c) / n;
}

const offs: number[] = [];
const odds: number[] = [];
for (let i = 0; i < 120; i++) {
  const best = bestPossible(draw5());
  if (!best) continue;
  offs.push(best.off);
  odds.push(perfectPct(best.off, 1500));
}
offs.sort((a, b) => a - b);
odds.sort((a, b) => a - b);
const pct = (arr: number[], p: number) => arr[Math.floor((p / 100) * (arr.length - 1))];

console.log("BEST-AFFORDABLE SQUAD ACROSS 120 RANDOM DRAWS (optimal play):");
console.log(`  off rating: p10=${pct(offs, 10).toFixed(1)} p50=${pct(offs, 50).toFixed(1)} p90=${pct(offs, 90).toFixed(1)} max=${offs[offs.length - 1].toFixed(1)}`);
console.log(`  perfect-season odds: p10=${pct(odds, 10).toFixed(2)}% p50=${pct(odds, 50).toFixed(2)}% p90=${pct(odds, 90).toFixed(2)}% max=${odds[odds.length - 1].toFixed(2)}%`);

// reference points
for (const off of [82, 85, 87.5, 90, 92, 94, 96]) {
  console.log(`  off=${off}: perfect=${perfectPct(off).toFixed(2)}%`);
}
