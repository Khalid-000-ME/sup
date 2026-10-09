/**
 * Assembles the final video from the recording and the narration.
 *   - converts the browser recording to constant frame rate,
 *   - per scene: keeps the recorded footage minus the ledger waits marked for cutting,
 *   - lays the narration over the scene (holding the last frame if the narration runs longer),
 *   - concatenates the scenes into out/sup-demo.mp4.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(root, "out");
const marks = JSON.parse(fs.readFileSync(path.join(OUT, "marks.json"), "utf8"));
const durations = JSON.parse(fs.readFileSync(path.join(OUT, "audio", "durations.json"), "utf8"));
const script = JSON.parse(fs.readFileSync(path.join(OUT, "..", "script.json"), "utf8"));
const FPS = 30;
const run = (args) => execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });

const webm = fs.readdirSync(path.join(OUT, "video")).filter((f) => f.endsWith(".webm"))[0];
const cfr = path.join(OUT, "rec-cfr.mp4");
console.log("constant frame rate:", webm);
run(["-i", path.join(OUT, "video", webm), "-r", String(FPS), "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", "-an", cfr]);

const parts = [];
const dir = path.join(OUT, "scenes");
fs.mkdirSync(dir, { recursive: true });
let total = 0;
for (const s of script.scenes) {
  const m = marks.scenes[s.id];
  if (!m) throw new Error(`scene ${s.id} was not recorded`);
  // keep [start, end] minus the cuts
  const keep = [];
  let at = m.start;
  for (const [a, b] of [...m.cuts].sort((x, y) => x[0] - y[0])) {
    if (a > at) keep.push([at, a]);
    at = Math.max(at, b);
  }
  if (m.end > at) keep.push([at, m.end]);
  const vd = keep.reduce((t, [a, b]) => t + (b - a), 0);
  const ad = durations[s.id] + 0.45;
  const D = Math.max(vd, ad);

  const labels = keep.map((_, i) => `[v${i}]`).join("");
  const trims = keep.map(([a, b], i) => `[0:v]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS}[v${i}]`).join(";");
  const pad = D - vd > 0.02 ? `,tpad=stop_mode=clone:stop_duration=${(D - vd).toFixed(3)}` : "";
  const filter = `${trims};${labels}concat=n=${keep.length}:v=1:a=0[c];[c]fade=t=in:st=0:d=0.25${pad}[vout];[1:a]apad=whole_dur=${D.toFixed(3)},afade=t=in:st=0:d=0.05[aout]`;
  const file = path.join(dir, `${s.id}.mp4`);
  run([
    "-i", cfr, "-i", path.join(OUT, "audio", `${s.id}.mp3`),
    "-filter_complex", filter, "-map", "[vout]", "-map", "[aout]",
    "-t", D.toFixed(3), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2", file,
  ]);
  console.log(s.id.padEnd(11), "video", vd.toFixed(1) + "s", "narration", ad.toFixed(1) + "s", "->", D.toFixed(1) + "s");
  total += D;
  parts.push(file);
}
fs.writeFileSync(path.join(dir, "list.txt"), parts.map((p) => `file '${p}'`).join("\n"));
const final = path.join(OUT, "sup-demo.mp4");
// video is copied untouched; audio is normalised to streaming loudness (-16 LUFS) so playback volume is consistent
run(["-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", final]);
console.log(`\nsup-demo.mp4  ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, "0")}  ->  ${final}`);
if (total > 300) console.warn("WARNING: longer than the 5 minute limit");
