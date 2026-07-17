import { useEffect, useMemo, useState } from "react";
import { TEAMS } from "../game/data";
import type { Team } from "../game/types";

const CELL = 110; // px per logo cell

/** Horizontal logo strip that decelerates onto the drawn team. */
export default function Wheel({ landing, spinKey, onDone }: {
  landing: Team;
  spinKey: number;
  onDone: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);

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
    return [...block1, ...block2].slice(0, 44);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  useEffect(() => {
    setAnimate(false);
    setOffset(0);
    const t1 = setTimeout(() => {
      setAnimate(true);
      setOffset(40 * CELL);
    }, 40);
    const t2 = setTimeout(onDone, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey]);

  return (
    <div className="wheel">
      <div className="wheel-pointer" />
      <div
        className="wheel-strip"
        style={{
          transform: `translateX(${-offset}px)`,
          transition: animate ? "transform 2.2s cubic-bezier(0.12, 0.8, 0.16, 1)" : "none",
        }}
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
