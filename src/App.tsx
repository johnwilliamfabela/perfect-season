import { useState } from "react";
import TeamBoard from "./components/TeamBoard";
import Results, { type TradeRecord } from "./components/Results";
import Wheel from "./components/Wheel";
import { fmtM, isRookieDeal, playersOf } from "./game/data";
import { drawTeam, openSlots, planFor, signingCost } from "./game/engine";
import {
  BUDGET,
  SLOTS,
  TRADE_FEE,
  type DrawRecord,
  type Player,
  type Roster,
  type SlotId,
  type Team,
} from "./game/types";


type Phase = "intro" | "spinning" | "picking" | "results";

const EMPTY_ROSTER: Roster = { QB: null, RB: null, WR1: null, WR2: null, TE: null };

export default function App() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [roster, setRoster] = useState<Roster>(EMPTY_ROSTER);
  const [remaining, setRemaining] = useState(BUDGET);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [draws, setDraws] = useState<DrawRecord[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [spinKey, setSpinKey] = useState(0);

  const signedIds = new Set(
    SLOTS.flatMap((s) => (roster[s] ? [roster[s]!.player.id] : [])),
  );
  const start = () => {
    setRoster(EMPTY_ROSTER);
    setRemaining(BUDGET);
    setDraws([]);
    setTrades([]);
    const team = drawTeam(BUDGET, EMPTY_ROSTER, new Set());
    setCurrentTeam(team);
    setSpinKey((k) => k + 1);
    setPhase("spinning");
  };

  const sign = (p: Player, outSlot?: SlotId) => {
    if (!currentTeam) return;
    const { slot, out } = planFor(p, roster, outSlot);
    if (out) setTrades([...trades, { out: out.player.name, in: p.name }]);
    const nextRoster = { ...roster, [slot]: { player: p, slot, fromTeam: currentTeam.name } };
    const nextRemaining = remaining - signingCost(p, roster, outSlot);
    setRoster(nextRoster);
    setRemaining(nextRemaining);
    const nextDraws = [...draws, { team: currentTeam.name, deal: null }];
    setDraws(nextDraws);
    if (openSlots(nextRoster).length === 0) {
      setPhase("results");
    } else {
      const nextIds = new Set(
        SLOTS.flatMap((s) => (nextRoster[s] ? [nextRoster[s]!.player.id] : [])),
      );
      const team = drawTeam(nextRemaining, nextRoster, nextIds, nextDraws.map((d) => d.team));
      setCurrentTeam(team);
      setSpinKey((k) => k + 1);
      setPhase("spinning");
    }
  };

  const spent = BUDGET - remaining;

  return (
    <div className="app">
      <header className="hdr">
        <div className="hdr-title">
          DREAM OFFENSE
          {phase !== "intro" && (
            <button className="btn btn-sm" onClick={start}>
              START OVER
            </button>
          )}
        </div>
        <div className="hdr-dots">
          {SLOTS.map((s) => (
            <span key={s} className={`dot ${roster[s] ? "dot-filled" : ""}`} />
          ))}
        </div>
        <div
          className={`bankroll ${
            remaining <= 25_000_000 ? "bankroll-low" : remaining <= 50_000_000 ? "bankroll-mid" : ""
          }`}
        >
          <span>REMAINING</span>
          {fmtM(remaining)}
        </div>
      </header>

      {phase !== "intro" && phase !== "results" && (
        <div className="slots">
          {SLOTS.map((s) => {
            const sg = roster[s];
            return (
              <div key={s} className={`slot ${sg ? "slot-filled" : ""}`}>
                <div className="slot-pos">{s}</div>
                {sg && (
                  <>
                    <div className="slot-name">{sg.player.name}</div>
                    <div className="slot-sub">
                      {sg.player.ovr} OVR · {sg.fromTeam}
                    </div>
                    <div className="slot-price">{fmtM(sg.player.apy)}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {phase === "intro" && (
        <div className="intro">
          <h1>
            BUILD YOUR DREAM <em>OFFENSE</em>
          </h1>
          <p className="intro-sub">
            Can you go <em>20–0</em>?
          </p>
          <div className="intro-steps">
            <div className="step">
              <div className="step-h">DRAFT</div>
              <div className="step-p">A random NFL team is drawn each round — real players, current rosters.</div>
            </div>
            <div className="step">
              <div className="step-h">SIGN</div>
              <div className="step-p">Pick one player per draw: a QB, an RB, two WRs, and a TE.</div>
            </div>
            <div className="step">
              <div className="step-h">SALARIES</div>
              <div className="step-p">
                Prices scale with rating and position scarcity — and stars still on rookie
                contracts come cheap. You get {fmtM(BUDGET)}.
              </div>
            </div>
            <div className="step">
              <div className="step-h">TRADE</div>
              <div className="step-p">
                Position filled? Swap him out — pay the new salary plus a {fmtM(TRADE_FEE)} fee,
                and the old contract comes back.
              </div>
            </div>
            <div className="step">
              <div className="step-h">WIN</div>
              <div className="step-p">
                Your five's average rating decides your season. A 91.0+ average goes 20–0.
              </div>
            </div>
          </div>
          <button className="btn btn-hot btn-big" onClick={start}>
            BEGIN DRAFT
          </button>
          <div className="fine">current player ratings · salaries set by rating and position scarcity</div>
        </div>
      )}

      {(phase === "spinning" || phase === "picking") && currentTeam && (
        <>
          <Wheel
            landing={currentTeam}
            spinKey={spinKey}
            golden={playersOf(currentTeam.name).some(isRookieDeal)}
            onDone={() => setPhase("picking")}
          />
          {phase === "picking" && (
            <TeamBoard
              team={currentTeam}
              roster={roster}
              remaining={remaining}
              signedIds={signedIds}
              onSign={sign}
            />
          )}
        </>
      )}

      {phase === "results" && (
        <Results roster={roster} draws={draws} trades={trades} spent={spent} onRestart={start} />
      )}
    </div>
  );
}
