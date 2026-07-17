import { fmtM } from "./data";

export interface ShareCardData {
  record: string;
  tag: string;
  five: { slot: string; ovr: number; name: string; price: number }[];
  avg: number;
  spent: number;
  budget: number;
}

const BG = "#0a0e0b";
const PANEL = "#101812";
const LINE = "#26392c";
const TEXT = "#dae4db";
const DIM = "#879a8b";
const HOT = "#34d399";
const GOLD = "#ffd76a";

const MONO = "ui-monospace, Menlo, monospace";
const SANS = "-apple-system, 'Segoe UI', Roboto, sans-serif";

/** Draw a 1080x1080 share card of the season result and return it as a PNG blob. */
export function renderShareCard(d: ShareCardData): Promise<Blob> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";

  ctx.fillStyle = HOT;
  ctx.font = `700 34px ${MONO}`;
  ctx.fillText("D R E A M   O F F E N S E", W / 2, 100);

  ctx.fillStyle = TEXT;
  ctx.font = `800 190px ${MONO}`;
  ctx.fillText(d.record, W / 2, 320);

  ctx.fillStyle = GOLD;
  ctx.font = `700 38px ${SANS}`;
  ctx.fillText(d.tag, W / 2, 400);

  // squad panel
  const px = 90;
  const py = 460;
  const pw = W - px * 2;
  const rowH = 74;
  const ph = rowH * d.five.length + 40;
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 20);
  ctx.fill();
  ctx.stroke();

  d.five.forEach((p, i) => {
    const y = py + 50 + i * rowH;
    ctx.textAlign = "left";
    ctx.fillStyle = HOT;
    ctx.font = `700 26px ${MONO}`;
    ctx.fillText(p.slot, px + 36, y);
    ctx.fillStyle = p.ovr >= 90 ? GOLD : TEXT;
    ctx.font = `800 36px ${MONO}`;
    ctx.fillText(String(p.ovr), px + 130, y + 2);
    ctx.fillStyle = TEXT;
    ctx.font = `700 34px ${SANS}`;
    ctx.fillText(p.name, px + 210, y + 1);
    ctx.textAlign = "right";
    ctx.fillStyle = GOLD;
    ctx.font = `700 30px ${MONO}`;
    ctx.fillText(fmtM(p.price), px + pw - 36, y);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = DIM;
  ctx.font = `600 30px ${MONO}`;
  ctx.fillText(
    `${d.avg.toFixed(1)} AVG OVR · SPENT ${fmtM(d.spent)} OF ${fmtM(d.budget)}`,
    W / 2,
    py + ph + 70,
  );

  ctx.fillStyle = TEXT;
  ctx.font = `800 44px ${SANS}`;
  ctx.fillText("Can you go 20–0?", W / 2, H - 70);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}
