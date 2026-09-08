#!/usr/bin/env python3
"""Generate the Rarity Reel narration clips with edge-tts.

Reads scripts/narration-rarity-reel.json and writes one MP3 per scene into
public/audio/narration/. Regenerate any time the script text changes:

    python scripts/generate-narration.py            # uses the voice in the JSON
    python scripts/generate-narration.py --voice en-IN-PrabhatNeural
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "narration-rarity-reel.json"
OUT = ROOT / "public" / "audio" / "narration"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=None, help="edge-tts voice name")
    ap.add_argument("--rate", default=None, help="edge-tts speaking rate, e.g. +15%")
    ap.add_argument("--index", type=int, default=None, help="only regenerate one scene (0-based)")
    args = ap.parse_args()

    data = json.loads(SCRIPT.read_text(encoding="utf-8"))
    voice = args.voice or data.get("voice")
    rate = args.rate or data.get("rate")
    scenes = data["scenes"] if args.index is None else [data["scenes"][args.index]]

    OUT.mkdir(parents=True, exist_ok=True)
    for scene in scenes:
        dest = OUT / scene["file"]
        cmd = ["edge-tts", "--voice", voice, "--text", scene["text"]]
        if rate:
            cmd += ["--rate", rate]
        cmd += ["--write-media", str(dest)]
        print(f"  {scene['file']}  <-  {voice}  rate={rate or 'default'}", file=sys.stderr)
        subprocess.run(cmd, check=True, capture_output=True)
    print(f"OK — {len(scenes)} clip(s) written to {OUT}")


if __name__ == "__main__":
    main()
