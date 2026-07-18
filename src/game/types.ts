export type Pos = "QB" | "RB" | "WR" | "TE";
export type SlotId = "QB" | "RB" | "WR1" | "WR2" | "TE";

export interface Player {
  id: number;
  name: string;
  team: string;
  pos: Pos;
  ovr: number;
  age: number;
  yearsPro: number;
  apy: number;
  avatar: string | null;
  abilities: string[];
  xfactor: boolean;
  cardStats: Record<string, number | null>;
}

export interface Team {
  name: string;
  logo: string | null;
  defRating: number;
  offRating: number; // computed at load: best-five weighted OVR
}

export interface Signing {
  player: Player;
  slot: SlotId;
  fromTeam: string; // team drawn when signed
}

export type Roster = Record<SlotId, Signing | null>;

export const SLOT_POS: Record<SlotId, Pos> = {
  QB: "QB",
  RB: "RB",
  WR1: "WR",
  WR2: "WR",
  TE: "TE",
};

export const SLOTS: SlotId[] = ["QB", "RB", "WR1", "WR2", "TE"];

export const BUDGET = 100_000_000;
export const TRADE_FEE = 10_000_000;
export const MIN_SALARY = 1_000_000;

/** One wheel draw: the team, and the golden-deal discount if that spin hit. */
export interface DrawRecord {
  team: string;
  deal: { playerId: number; price: number } | null;
}

/** How the season ended: champion, or the round of the final loss. */
export type SeasonExit = "CHAMP" | "SB" | "CONF" | "DIV" | "MISSED";

export interface GameResult {
  wins: number;
  losses: number;
  perfect: boolean; // 20-0
  gameLog: { opp: string; us: number; them: number; tag: string }[];
  exit: SeasonExit;
}

export interface SimSummary {
  perfectPct: number; // % of sims achieving the perfect season
  sbReachPct: number; // % of sims reaching the Super Bowl (win or lose)
  avgWins: number;
  avgPF: number;
  avgPA: number;
  featured: GameResult; // median season — the stable benchmark
  sampled: GameResult; // one honestly-rolled season — the one you "lived"
  offRating: number;
}
