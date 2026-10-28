"""Download the myScheme PDF dump from Hugging Face (Navraj025/gov_myscheme).

Usage: python scripts/download_dataset.py data/raw/myscheme_pdfs
Skips the dataset's " copy.pdf" duplicates and files already downloaded.
Hugging Face rate-limits bursts, so this downloads one file at a time with backoff.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

REPO = "Navraj025/gov_myscheme"


def list_files():
    with urllib.request.urlopen(f"https://huggingface.co/api/datasets/{REPO}", timeout=60) as r:
        info = json.load(r)
    return [
        s["rfilename"]
        for s in info.get("siblings", [])
        if s["rfilename"].startswith("text_data/") and s["rfilename"].endswith(".pdf") and not s["rfilename"].endswith(" copy.pdf")
    ]


def main(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    files = list_files()
    failed = []
    for i, path in enumerate(files, 1):
        dest = os.path.join(out_dir, path.split("/", 1)[1])
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            continue
        url = f"https://huggingface.co/datasets/{REPO}/resolve/main/{urllib.parse.quote(path)}"
        for attempt in range(6):
            try:
                with urllib.request.urlopen(url, timeout=60) as r:
                    data = r.read()
                with open(dest, "wb") as f:
                    f.write(data)
                break
            except Exception:  # noqa: BLE001 - retry on rate limits / network errors
                time.sleep(5 * (attempt + 1))
        else:
            failed.append(path)
        if i % 200 == 0:
            print(f"{i}/{len(files)}")
    print(f"done: {len(files) - len(failed)} files, {len(failed)} failed")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "data/raw/myscheme_pdfs")
