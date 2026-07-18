import { TEAMS, playersOf } from "./data";
import {
  MIN_SALARY,
  SLOT_POS,
  SLOTS,
  TRADE_FEE,
  type Player,
  type Pos,
  type Roster,
  type Signing,
  type SlotId,
  type Team,
} from "./types";

export function openSlots(roster: Roster): SlotId[] {
  return SLOTS.filter((s) => roster[s] === null);
}

export function slotForPos(roster: Roster, pos: Pos): SlotId | null {
  return openSlots(roster).find((s) => SLOT_POS[s] === pos) ?? null;
}

export interface SigningPlan {
  slot: SlotId;
  /** The player being traded away (his salary comes back, minus the fee). */
  out: Signing | null;
}

/**
 * Where a signing would land: an open slot at his position, or — if his
 * position is full — a trade. `outSlot` picks who gets swapped out (falls
 * back to the lowest-rated player at the position).
 */
export function planFor(p: Player, roster: Roster, outSlot?: SlotId): SigningPlan {
  const open = slotForPos(roster, p.pos);
  if (open) return { slot: open, out: null };
  if (outSlot && SLOT_POS[outSlot] === p.pos && roster[outSlot]) {
    return { slot: outSlot, out: roster[outSlot]! };
  }
  const filled = SLOTS.filter((s) => SLOT_POS[s] === p.pos);
  const worst = filled.reduce((a, b) =>
    roster[b]!.player.ovr < roster[a]!.player.ovr ? b : a,
  );
  return { slot: worst, out: roster[worst]! };
}

/** Net cash needed to execute a signing (negative = money back). */
export function signingCost(p: Player, roster: Roster, outSlot?: SlotId): number {
  const { out } = planFor(p, roster, outSlot);
  return out ? p.apy + TRADE_FEE - out.player.apy : p.apy;
}

export function canSign(
  p: Player,
  remaining: number,
  roster: Roster,
  signedIds: Set<number>,
  outSlot?: SlotId,
  tradeAllowed = true,
): boolean {
  if (signedIds.has(p.id)) return false;
  const { out } = planFor(p, roster, outSlot);
  if (out && !tradeAllowed) return false; // one trade per season
  // keep a league-minimum reserve for every slot still unfilled afterwards
  const reserve = (openSlots(roster).length - (out ? 0 : 1)) * MIN_SALARY;
  return signingCost(p, roster, outSlot) <= remaining - reserve;
}

/** A team is drawable if at least one of its players is signable right now. */
function isDrawable(team: Team, remaining: number, roster: Roster, signedIds: Set<number>, tradeAllowed: boolean): boolean {
  return playersOf(team.name).some((p) => canSign(p, remaining, roster, signedIds, undefined, tradeAllowed));
}

export function drawTeam(
  remaining: number,
  roster: Roster,
  signedIds: Set<number>,
  excludeTeams: string[] = [],
  tradeAllowed = true,
): Team {
  // never draw a team twice in one game (falls back only if that empties the pool)
  const candidates = TEAMS.filter(
    (t) => !excludeTeams.includes(t.name) && isDrawable(t, remaining, roster, signedIds, tradeAllowed),
  );
  const pool = candidates.length > 0 ? candidates : TEAMS.filter((t) => isDrawable(t, remaining, roster, signedIds, tradeAllowed));
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Board for a drawn team: players grouped by position, sorted by OVR. */
export function teamBoard(team: Team): Record<Pos, Player[]> {
  const groups: Record<Pos, Player[]> = { QB: [], RB: [], WR: [], TE: [] };
  for (const p of playersOf(team.name)) groups[p.pos].push(p);
  for (const pos of Object.keys(groups) as Pos[]) groups[pos].sort((a, b) => b.ovr - a.ovr);
  return groups;
}
