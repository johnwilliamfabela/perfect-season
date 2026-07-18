import { useEffect, useMemo, useRef } from "react";
import { TEAMS } from "../game/data";
import type { Team } from "../game/types";

const CELL = 110; // px per logo cell
const EASING = "transform 2.2s cubic-bezier(0.12, 0.8, 0.16, 1)";

/** Horizontal logo strip that decelerates onto the drawn team. */
export default function Wheel({ landing, spinKey, onDone }: {
  landing: Team;
  spinKey: number;
  onDone: () => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  // A strip of two shuffled full-league blocks (no adjacent repeats) whose
  // 40th cell is the landing team.
  const strip = useMemo(() => {
    const shuffled = () => {
      const a = [...TEAMS];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const block1 = shuffled();
    const block2 = shuffled();
    // landing team sits at block2[8] => strip index 32 + 8 = 40
    const li = block2.findIndex((t) => t.name === landing.name);
    [block2[8], block2[li]] = [block2[li], block2[8]];
    // avoid a repeat across the block boundary
    if (block2[0].name === block1[block1.length - 1].name) {
      [block2[0], block2[1]] = [block2[1], block2[0]];
    }
    return [...block1, ...block2].slice(0, 52);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  useEffect(() => {
    // Direct DOM writes with a forced reflow in between: the reset frame is
    // guaranteed to be committed before the animation starts, so the spin can
    // never collapse into an instant jump under load.
    const el = stripRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = "translateX(0px)";
      void el.offsetWidth; // force reflow
      el.style.transition = EASING;
      el.style.transform = `translateX(${-40 * CELL}px)`;
    }
    const t2 = setTimeout(onDone, 2400);
    return () => clearTimeout(t2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  return (
    <div className="wheel">
      <div className="wheel-pointer" />
      <div
        ref={stripRef}
        className="wheel-strip"
        style={{ transform: "translateX(0px)", transition: "none" }}
      >
        {strip.map((t, i) => (
          <div className="wheel-cell" key={i}>
            {t.logo ? <img src={t.logo} alt={t.name} /> : <span>{t.name}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
