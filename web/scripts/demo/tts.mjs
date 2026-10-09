/**
 * Narration audio, one clip per scene, with Microsoft's neural voices through `edge-tts`
 * (pip install edge-tts). Far more natural than the macOS `say` voices, free, no API key.
 * Writes out/audio/<id>.mp3 and out/audio/durations.json.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(root, "out", "audio");
fs.mkdirSync(OUT, { recursive: true });
const script = JSON.parse(fs.readFileSync(path.join(root, "script.json"), "utf8"));
const bin = process.env.EDGE_TTS ?? "edge-tts";

const durations = {};
for (const s of script.scenes) {
  const file = path.join(OUT, `${s.id}.mp3`);
  if (!fs.existsSync(file) || process.env.FORCE_TTS) {
    execFileSync(bin, ["--voice", script.voice, `--rate=${script.rate}`, "--text", s.say, "--write-media", file], { stdio: "pipe" });
  }
  const d = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim();
  durations[s.id] = Number(d);
  console.log(s.id.padEnd(11), durations[s.id].toFixed(1) + "s");
}
fs.writeFileSync(path.join(OUT, "durations.json"), JSON.stringify(durations, null, 2));
console.log("total narration:", Object.values(durations).reduce((a, b) => a + b, 0).toFixed(1) + "s");
