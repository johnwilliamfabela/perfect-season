import { LEAGUE_AVG_DEF, LEAGUE_AVG_OFF, TEAMS, playersOf, weightedOvr } from "./data";
import {
  BUDGET,
  SLOT_POS,
  SLOTS,
  type GameResult,
  type Player,
  type Roster,
  type SimSummary,
  type SlotId,
  type Team,
} from "./types";

const PPG_BASE = 22.0;
const PPG_PER_OVR = 2.5; // expected points per weighted-OVR point above league avg
const DEF_FACTOR = 0.5; // how much an above-avg opposing defense suppresses scoring
const SCORE_SD = 5.2;
const N_SIMS = 3000;

function gauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function rosterOff(roster: Roster): number {
  const five = SLOTS.map((s) => roster[s]!.player);
  return weightedOvr(five);
}

function simGame(off: number, opp: Team): { us: number; them: number } {
  const usMu = PPG_BASE + (off - LEAGUE_AVG_OFF) * PPG_PER_OVR - (opp.defRating - LEAGUE_AVG_DEF) * DEF_FACTOR;
  // our supporting cast (defense etc.) is league average
  const themMu = PPG_BASE + (opp.offRating - LEAGUE_AVG_OFF) * PPG_PER_OVR;
  let us = Math.max(0, Math.round(usMu + gauss() * SCORE_SD));
  let them = Math.max(0, Math.round(themMu + gauss() * SCORE_SD));
  if (us === them) Math.random() < 0.5 ? us++ : them++; // sudden-death OT
  return { us, them };
}

function schedule(): Team[] {
  const others = [...TEAMS];
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const games = others.slice(0, 14);
  for (let i = 0; i < 3; i++) games.push(others[Math.floor(Math.random() * 14)]); // divisional rematches
  return games;
}

function playoffOpponent(topN: number): Team {
  const strong = [...TEAMS].sort(
    (a, b) => b.offRating + b.defRating - (a.offRating + a.defRating),
  ).slice(0, topN);
  return strong[Math.floor(Math.random() * strong.length)];
}

const ROUNDS = [
  { tag: "Divisional", topN: 14 },
  { tag: "Conference Championship", topN: 10 },
  { tag: "Super Bowl", topN: 6 },
];

/**
 * The gauntlet: 17 regular-season games, then the playoffs — but every
 * regular-season loss lowers your playoff ceiling by one round. Only a 17-0
 * team can win the Super Bowl; a one-loss team's road ends IN the Super Bowl,
 * a two-loss team's in the Conference Championship, and so on. Reaching your
 * ceiling round always ends in a loss; you can also get upset before it.
 */
export function simSeason(off: number): GameResult {
  const log: GameResult["gameLog"] = [];
  let wins = 0, losses = 0;
  for (const opp of schedule()) {
    const { us, them } = simGame(off, opp);
    if (us > them) wins++; else losses++;
    log.push({ opp: opp.name, us, them, tag: "" });
  }
  const regLosses = losses;
  if (wins < 10) {
    return { wins, losses, perfect: false, gameLog: log, exit: "MISSED" };
  }
  const ceiling = Math.max(0, 3 - regLosses); // playoff rounds you can still win
  let exit: GameResult["exit"] = "CHAMP";
  let eliminated = false;
  // all three rounds are always played, so a playoff season is exactly 20 games;
  // once the run dies, the remaining rounds are losses
  for (let i = 0; i < ROUNDS.length; i++) {
    const { tag, topN } = ROUNDS[i];
    const opp = playoffOpponent(topN);
    let { us, them } = simGame(off, opp);
    if ((eliminated || i >= ceiling) && us > them) [us, them] = [them, us];
    log.push({ opp: opp.name, us, them, tag });
    if (us > them) {
      wins++;
    } else {
      losses++;
      if (!eliminated) {
        eliminated = true;
        exit = tag === "Super Bowl" ? "SB" : tag === "Conference Championship" ? "CONF" : "DIV";
      }
    }
  }
  const perfect = exit === "CHAMP";
  return { wins, losses, perfect, gameLog: log, exit };
}

export function runSims(roster: Roster): SimSummary {
  return runSimsOff(rosterOff(roster));
}

export function runSimsOff(off: number): SimSummary {
  const results: GameResult[] = [];
  let perfectCount = 0, sbCount = 0, winSum = 0, pf = 0, pa = 0, games = 0;
  for (let i = 0; i < N_SIMS; i++) {
    const r = simSeason(off);
    results.push(r);
    if (r.perfect) perfectCount++;
    if (r.exit === "SB" || r.exit === "CHAMP") sbCount++;
    winSum += r.wins;
    for (const g of r.gameLog) {
      pf += g.us; pa += g.them; games++;
    }
  }
  results.sort((a, b) => a.wins - b.wins);
  const featured = results[Math.floor(results.length / 2)];
  const sampled = results[Math.floor(Math.random() * results.length)];
  return {
    sampled,
    perfectPct: (100 * perfectCount) / N_SIMS,
    sbReachPct: (100 * sbCount) / N_SIMS,
    avgWins: winSum / N_SIMS,
    avgPF: pf / games,
    avgPA: pa / games,
    featured,
    offRating: off,
  };
}

/**
 * Best squad you could have signed from the exact five teams drawn, within
 * budget: one player per drawn team, one per slot. Exhaustive over slot->team
 * assignments x top candidates, keeping the highest weighted OVR under budget.
 */
export function bestPossible(drawnTeams: string[]): { five: { slot: SlotId; player: Player }[]; off: number; cost: number } | null {
  const K = 5; // candidates per (team, slot)
  const cands: Player[][][] = drawnTeams.map((team) =>
    SLOTS.map((slot) =>
      playersOf(team)
        .filter((p) => p.pos === SLOT_POS[slot])
        .sort((a, b) => b.ovr - a.ovr)
        .slice(0, K),
    ),
  );

  // all ways to assign 5 distinct drawn teams (possibly more than 5 draws) to the 5 slots
  const perms: number[][] = [];
  const permute = (rest: number[], acc: number[]) => {
    if (acc.length === SLOTS.length) return void perms.push(acc);
    for (let i = 0; i < rest.length; i++)
      permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, rest[i]]);
  };
  permute(drawnTeams.map((_, i) => i), []);

  let best: { five: { slot: SlotId; player: Player }[]; off: number; cost: number } | null = null;

  for (const perm of perms) {
    // perm[slotIdx] = team index filling that slot
    const options = SLOTS.map((_, si) => cands[perm[si]][si]);
    if (options.some((o) => o.length === 0)) continue;
    const search = (si: number, chosen: Player[], cost: number, usedIds: Set<number>) => {
      if (cost > BUDGET) return;
      if (si === SLOTS.length) {
        const off = weightedOvr(chosen);
        if (!best || off > best.off || (off === best.off && cost < best.cost)) {
          best = { five: chosen.map((p, i) => ({ slot: SLOTS[i], player: p })), off, cost };
        }
        return;
      }
      for (const p of options[si]) {
        if (usedIds.has(p.id)) continue;
        usedIds.add(p.id);
        search(si + 1, [...chosen, p], cost + p.apy, usedIds);
        usedIds.delete(p.id);
      }
    };
    search(0, [], 0, new Set());
  }
  return best;
}
