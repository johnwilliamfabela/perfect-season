import { useMemo, useState } from "react";
import { TEAMS, fmtM } from "../game/data";
import { renderShareCard } from "../game/shareCard";
import { bestPossible, runSims, runSimsOff } from "../game/sim";
import { BUDGET, SLOTS, type DrawRecord, type Player, type Roster, type SlotId } from "../game/types";

export interface TradeRecord {
  out: string;
  in: string;
}

function SquadRow({ slot, player, from }: { slot: SlotId; player: Player; from: string }) {
  const logo = TEAMS.find((t) => t.name === from)?.logo;
  return (
    <div className="res-row">
      <span className="res-slot">{slot}</span>
      <span className="res-ovr">
        {player.ovr}
        <span className="res-ovr-label">OVR</span>
      </span>
      <span className="res-name">
        {logo && <img className="res-logo" src={logo} alt={from} title={from} />}
        {player.name}
      </span>
      <span className="res-price">{fmtM(player.apy)}</span>
    </div>
  );
}

function TotalRow({ five, cost }: { five: { slot: SlotId; player: Player }[]; cost: number }) {
  const avg = five.reduce((s, f) => s + f.player.ovr, 0) / five.length;
  return (
    <div className="res-row res-total">
      <span className="res-slot" />
      <span className="res-ovr">
        {avg.toFixed(1)}
        <span className="res-ovr-label">AVG</span>
      </span>
      <span className="res-name" />
      <span className="res-price">{fmtM(cost)}</span>
    </div>
  );
}

export default function Results({ roster, draws, trades, spent, onRestart }: {
  roster: Roster;
  draws: DrawRecord[];
  trades: TradeRecord[];
  spent: number;
  onRestart: () => void;
}) {
  const sim = useMemo(() => runSims(roster), [roster]);
  const best = useMemo(() => bestPossible(draws), [draws]);
  const bestSim = useMemo(() => (best ? runSimsOff(best.off) : null), [best]);
  const f = sim.sampled; // the season you actually lived — 20-0 is genuinely hittable
  const yourFive = SLOTS.map((s) => ({ slot: s, player: roster[s]!.player }));
  const pickedBest =
    best !== null &&
    new Set(best.five.map((x) => x.player.id)).size === 5 &&
    best.five.every((x) => yourFive.some((y) => y.player.id === x.player.id));
  const yourAvg = yourFive.reduce((s, x) => s + x.player.ovr, 0) / yourFive.length;
  // different five, but rated even with the ideal squad — the process was still perfect
  const matchedBest = !pickedBest && best !== null && yourAvg >= best.off - 1e-9;
  // your rolled season kept pace with the ideal squad's benchmark record
  const recordMatch =
    !pickedBest && !matchedBest && bestSim !== null && f.wins >= bestSim.featured.wins;
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");

  // story is a pure function of the win count so record and tag always agree:
  // 20 = perfect, 19 = SB loss, 18 = conference, 17 = divisional, then generic tiers
  const exitTag = f.perfect
    ? "PERFECT SEASON. IMMORTALITY."
    : f.wins >= 19
      ? "Lost the Super Bowl. One win short of forever."
      : f.wins >= 18
        ? "Died in the Conference Championship."
        : f.wins >= 17
          ? "One-and-done in the Divisional Round."
          : f.exit !== "MISSED"
            ? "Made the playoffs. The dream didn't survive them."
            : "Watching the playoffs from the couch.";

  const shareText = () => {
    const lines = SLOTS.map((s) => {
      const sg = roster[s]!;
      return `${s}: ${sg.player.name} (${sg.player.ovr}) ${fmtM(sg.player.apy)}`;
    });
    return `Dream Offense 🏈\nMy season: ${f.wins}–${f.losses}\n${lines.join("\n")}\nSpent ${fmtM(spent)} of ${fmtM(BUDGET)}`;
  };

  const share = async () => {
    const avg = yourAvg;
    const blob = await renderShareCard({
      record: `${f.wins}–${f.losses}`,
      tag: exitTag,
      five: yourFive.map(({ slot, player }) => ({
        slot,
        ovr: player.ovr,
        name: player.name,
        price: player.apy,
      })),
      avg,
      spent,
      budget: BUDGET,
    });
    const file = new File([blob], "perfect-season.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Dream Offense", text: shareText() });
        return;
      } catch {
        // user cancelled the sheet — nothing to clean up
        return;
      }
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setShareState("copied");
    } catch {
      try {
        await navigator.clipboard.writeText(shareText());
        setShareState("copied");
      } catch {
        setShareState("failed");
      }
    }
    setTimeout(() => setShareState("idle"), 2000);
  };

  return (
    <div className="results">
      <div className="res-hero">
        <div className="res-record">
          {f.wins}–{f.losses}
        </div>
        <div className="res-tag">{exitTag}</div>
        <div className="res-sub">
          spent {fmtM(spent)} of {fmtM(BUDGET)} · this squad goes 20–0 in{" "}
          {sim.perfectPct < 0.05 ? "<0.05" : sim.perfectPct.toFixed(1)}% of seasons
        </div>
      </div>

      {pickedBest && (
        <div className="res-best-pick">
          🏆 FLAWLESS — you signed the best possible squad from your draws.
        </div>
      )}
      {matchedBest && (
        <div className="res-best-pick">
          🏆 MAXED OUT — your five rates even with the best possible squad.
        </div>
      )}
      {recordMatch && (
        <div className="res-best-pick">
          🏆 CAN'T BEAT THAT — you matched the best possible squad's record.
        </div>
      )}

      <div className="res-squad">
        <h3>🏈 YOUR SQUAD</h3>
        {yourFive.map(({ slot, player }) => (
          <SquadRow key={slot} slot={slot} player={player} from={roster[slot]!.fromTeam} />
        ))}
        <TotalRow five={yourFive} cost={spent} />
        {trades.length > 0 && (
          <div className="res-trades">
            {trades.map((t, i) => (
              <div key={i} className="res-sub">
                TRADE: {t.out} → {t.in}
              </div>
            ))}
          </div>
        )}
      </div>

      {best && bestSim && !pickedBest && !matchedBest && !recordMatch && (
        <div className="res-squad res-best">
          <h3>
            🏆 BEST POSSIBLE SQUAD{" "}
            <span className="res-sub">
              sim record {bestSim.featured.wins}–{bestSim.featured.losses}
            </span>
          </h3>
          {best.five.map(({ slot, player }) => (
            <SquadRow key={slot} slot={slot} player={player} from={player.team} />
          ))}
          <TotalRow five={best.five} cost={best.cost} />
          <div className="res-sub" style={{ marginTop: 8 }}>
            The highest-rated five from the exact teams you drew.
          </div>
        </div>
      )}

      <div className="res-actions">
        <button className="btn btn-hot" onClick={onRestart}>
          PLAY AGAIN
        </button>
        <button className="btn" onClick={share}>
          {shareState === "copied" ? "COPIED!" : shareState === "failed" ? "COULDN'T SHARE" : "SHARE"}
        </button>
      </div>
    </div>
  );
}
