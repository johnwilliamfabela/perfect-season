import { useState } from "react";
import TeamBoard from "./components/TeamBoard";
import Results, { type TradeRecord } from "./components/Results";
import Wheel from "./components/Wheel";
import { fmtM } from "./game/data";
import { drawTeam, openSlots, planFor, signingCost } from "./game/engine";
import {
  BUDGET,
  SLOTS,
  TRADE_FEE,
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
  const [drawnTeams, setDrawnTeams] = useState<string[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [spinKey, setSpinKey] = useState(0);

  const signedIds = new Set(
    SLOTS.flatMap((s) => (roster[s] ? [roster[s]!.player.id] : [])),
  );
  const start = () => {
    setRoster(EMPTY_ROSTER);
    setRemaining(BUDGET);
    setDrawnTeams([]);
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
    setDrawnTeams([...drawnTeams, currentTeam.name]);
    if (openSlots(nextRoster).length === 0) {
      setPhase("results"); // fifth slot filled — straight to the season
    } else {
      const nextIds = new Set(
        SLOTS.flatMap((s) => (nextRoster[s] ? [nextRoster[s]!.player.id] : [])),
      );
      const team = drawTeam(nextRemaining, nextRoster, nextIds);
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
          THE PERFECT SEASON
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
            BUILD YOUR PERFECT <em>OFFENSE</em>
          </h1>
          <p className="intro-sub">
            Can you go <em>20–0</em>?
          </p>
          <ol>
            <li>The wheel lands on one of the 32 NFL teams.</li>
            <li>Sign one player from it: a QB, an RB, two WRs, and a TE fill your five slots.</li>
            <li>
              Salaries are set by overall rating and position scarcity — the thinner the talent
              pool at a position, the pricier its stars. You have {fmtM(BUDGET)}.
            </li>
            <li>
              Position already filled? You can still sign there as a trade: pay the new salary
              plus a {fmtM(TRADE_FEE)} fee, and your old player's contract comes off the books.
            </li>
            <li>Blow it early and you'll be scraping league-minimum depth guys by the fifth slot.</li>
            <li>
              We simulate the 17-game season plus the playoffs. Every regular-season loss lowers
              your playoff ceiling by one round — only a 17–0 team can win the Super Bowl. 20–0 is
              immortality.
            </li>
          </ol>
          <button className="btn btn-hot btn-big" onClick={start}>
            START THE WHEEL
          </button>
          <div className="fine">current player ratings · salaries set by rating and position scarcity</div>
        </div>
      )}

      {(phase === "spinning" || phase === "picking") && currentTeam && (
        <>
          <Wheel landing={currentTeam} spinKey={spinKey} onDone={() => setPhase("picking")} />
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
        <Results roster={roster} drawnTeams={drawnTeams} trades={trades} spent={spent} onRestart={start} />
      )}
    </div>
  );
}
