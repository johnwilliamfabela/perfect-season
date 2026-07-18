import { useState } from "react";
import { fmtM, isRookieDeal, priceFor } from "../game/data";
import { canSign, planFor, signingCost, slotForPos, teamBoard } from "../game/engine";
import {
  SLOTS,
  SLOT_POS,
  TRADE_FEE,
  type Player,
  type Pos,
  type Roster,
  type Signing,
  type SlotId,
  type Team,
} from "../game/types";

const POS_ORDER: Pos[] = ["QB", "RB", "WR", "TE"];

function PlayerCard({ p, origPrice, signable, onRoster, out, net, canSwap, onSwap, onSign }: {
  p: Player;
  origPrice: number | null; // sticker price when this card is a golden deal
  signable: boolean;
  onRoster: boolean;
  out: Signing | null;
  net: number;
  canSwap: boolean;
  onSwap: () => void;
  onSign: () => void;
}) {
  const cta = onRoster ? "ON ROSTER" : out ? "TRADE" : "DRAFT";
  const title =
    out && !onRoster
      ? `${fmtM(p.apy)} + ${fmtM(TRADE_FEE)} fee − ${out.player.name}'s ${fmtM(out.player.apy)} back`
      : undefined;
  return (
    <div className={`pcard ${signable ? "" : "pcard-off"} ${origPrice !== null ? "pcard-gold" : ""}`}>
      <div className="pcard-top">
        <span className={`ovr ${p.ovr >= 90 ? "ovr-elite" : p.ovr >= 80 ? "ovr-good" : ""}`}>
          {p.ovr}
          <span className="ovr-label">OVR</span>
        </span>
        {origPrice !== null && <span className="badge-gold">ROOKIE DEAL</span>}
      </div>
      <div className="pcard-name">
        {p.name}
        {out && !onRoster && (
          <span
            className={
              p.ovr > out.player.ovr ? "arrow-up" : p.ovr < out.player.ovr ? "arrow-down" : "arrow-even"
            }
          >
            {p.ovr > out.player.ovr ? "▲" : p.ovr < out.player.ovr ? "▼" : "="}
          </span>
        )}
      </div>
      {out ? (
        <>
          <div className="pcard-price" title={title}>
            <span className={net < 0 ? "net-back" : ""}>
              {net < 0 ? "+" : ""}
              {fmtM(Math.abs(net))}
            </span>
          </div>
          <div className="pcard-out">
            <span className="pcard-out-label">SWAP</span>
            <span className="pcard-out-name">
              {out.player.name} ({out.player.ovr})
            </span>
            {canSwap && (
              <button
                className="swap-btn"
                onClick={onSwap}
                title="Swap which player gets sent back"
                aria-label="Swap trade-out player"
              >
                ⇄
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="pcard-price">
          {origPrice !== null && <s className="pcard-was">{fmtM(origPrice)}</s>}
          {fmtM(p.apy)}
        </div>
      )}
      {origPrice !== null && (
        <div className="pcard-deal-note">Year {p.yearsPro + 1} of his rookie contract</div>
      )}
      <button
        className={`pcard-cta ${out && !onRoster ? "pcard-cta-trade" : ""}`}
        disabled={!signable}
        onClick={onSign}
        title={title}
        aria-label={`${out ? "Trade for" : "Draft"} ${p.name}, ${p.ovr} overall`}
      >
        {cta}
      </button>
    </div>
  );
}

export default function TeamBoard({ team, roster, remaining, signedIds, onSign }: {
  team: Team;
  roster: Roster;
  remaining: number;
  signedIds: Set<number>;
  onSign: (p: Player, outSlot?: SlotId) => void;
}) {
  const board = teamBoard(team);
  const anyTrade = POS_ORDER.some((pos) => slotForPos(roster, pos) === null);
  // who to send back, per position — only offered when 2+ slots are filled (WR)
  const [outSel, setOutSel] = useState<Partial<Record<Pos, SlotId>>>({});
  return (
    <div className="board">
      <div className="board-head">
        {team.logo && <img src={team.logo} alt="" />}
        <div>
          <div className="board-team">{team.name}</div>
        </div>
        {anyTrade && (
          <div className="board-note">Trades cost salary + {fmtM(TRADE_FEE)}</div>
        )}
      </div>
      <div className="board-cols" style={{ ["--cols" as string]: POS_ORDER.length }}>
        {POS_ORDER.map((pos) => {
          const isTrade = slotForPos(roster, pos) === null;
          const filledSlots = SLOTS.filter((s) => SLOT_POS[s] === pos && roster[s]);
          const outSlot = isTrade ? outSel[pos] : undefined;
          const sample = board[pos][0];
          const out = isTrade && sample ? planFor(sample, roster, outSlot).out : null;
          return (
            <div className="board-col" key={pos}>
              <div className="board-pos">
                {pos}
                {isTrade && <span className="badge-trade">TRADE</span>}
              </div>
              {board[pos].map((p) => {
                const isDeal = isRookieDeal(p);
                return (
                  <PlayerCard
                    key={p.id}
                    p={p}
                    origPrice={isDeal ? priceFor(p.ovr, p.pos) : null}
                    signable={canSign(p, remaining, roster, signedIds, outSlot)}
                    onRoster={signedIds.has(p.id)}
                    out={isTrade ? out : null}
                    net={signingCost(p, roster, outSlot)}
                    canSwap={isTrade && filledSlots.length > 1}
                    onSwap={() => {
                      const other = filledSlots.find((s) => roster[s] !== out);
                      if (other) setOutSel({ ...outSel, [pos]: other });
                    }}
                    onSign={() => onSign(p, outSlot)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
