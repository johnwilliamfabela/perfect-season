import rawPlayers from "../data/players.json";
import rawTeams from "../data/teams.json";
import type { Player, Team, Pos } from "./types";

/**
 * Rating-banded pricing with position scarcity: cost is a ladder of overall
 * rating, adjusted by how thin each position's talent pool is at that tier
 * (relative to demand — you need TWO wide receivers). Real contracts are
 * ignored — legibility over realism.
 */
const PRICE_BANDS: Record<Pos, [number, number][]> = {
  QB: [[96, 32_000_000], [93, 28_000_000], [90, 22_000_000], [87, 14_000_000], [84, 10_000_000], [80, 6_000_000], [76, 2_000_000]],
  RB: [[96, 30_000_000], [93, 24_000_000], [90, 18_000_000], [87, 13_000_000], [84, 9_000_000], [80, 4_000_000], [76, 2_000_000]],
  WR: [[96, 36_000_000], [93, 28_000_000], [90, 19_000_000], [87, 13_000_000], [84, 9_000_000], [80, 5_000_000], [76, 2_000_000]],
  TE: [[96, 34_000_000], [93, 30_000_000], [90, 20_000_000], [87, 15_000_000], [84, 10_000_000], [80, 5_000_000], [76, 2_000_000]],
};

export function priceFor(ovr: number, pos: Pos): number {
  for (const [min, price] of PRICE_BANDS[pos]) if (ovr >= min) return price;
  return 1_000_000;
}

/** 90+ stars still on rookie contracts (years 1-4) are permanently 30% off. */
export function isRookieDeal(p: { ovr: number; yearsPro: number }): boolean {
  return p.ovr >= 90 && p.yearsPro <= 3;
}

export const PLAYERS = (rawPlayers as unknown as Player[]).map((p) => ({
  ...p,
  apy: isRookieDeal(p)
    ? Math.max(1_000_000, Math.round((priceFor(p.ovr, p.pos) * 0.7) / 500_000) * 500_000)
    : priceFor(p.ovr, p.pos),
}));

/** Offense rating: plain average OVR of the five — every slot counts the same. */
export function weightedOvr(five: { pos: Pos; ovr: number }[]): number {
  return five.reduce((s, p) => s + p.ovr, 0) / five.length;
}

function bestFiveFor(team: string): { pos: Pos; ovr: number }[] {
  const byPos = (pos: Pos, n: number) =>
    PLAYERS.filter((p) => p.team === team && p.pos === pos)
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, n);
  return [...byPos("QB", 1), ...byPos("RB", 1), ...byPos("WR", 2), ...byPos("TE", 1)];
}

export const TEAMS: Team[] = (rawTeams as Omit<Team, "offRating">[]).map((t) => ({
  ...t,
  offRating: weightedOvr(bestFiveFor(t.name)),
}));

export const LEAGUE_AVG_OFF =
  TEAMS.reduce((s, t) => s + t.offRating, 0) / TEAMS.length;
export const LEAGUE_AVG_DEF =
  TEAMS.reduce((s, t) => s + t.defRating, 0) / TEAMS.length;

export function playersOf(team: string): Player[] {
  return PLAYERS.filter((p) => p.team === team);
}

export function fmtM(dollars: number): string {
  return `$${(dollars / 1e6).toFixed(1)}M`;
}

/**
 * Deterministic season: your five's average rating IS your record.
 * 91+ runs the table (20-0); each point below costs a win. Playoff seasons
 * (10+ wins) are 20 games; sub-playoff seasons are 17.
 */
export function recordFor(avg: number): { wins: number; losses: number } {
  const wins = avg >= 91 ? 20 : Math.max(4, Math.floor(avg) - 71);
  return wins >= 10 ? { wins, losses: 20 - wins } : { wins, losses: 17 - wins };
}
