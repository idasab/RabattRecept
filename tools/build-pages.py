"""Bygger appen till docs/, som GitHub Pages serverar.

Körs med `python tools/build-pages.py`. Resultatet hamnar på grenen du står på,
så det blir en enda `git push` — GitHub Pages ställs in på gren `main` och mapp
`/docs`. Priset är att bygget syns i källträdet och i varje diff, vilket är den
avvägning som gjordes: en ren pushrutin är värd mer än en ren diff i ett litet
projekt med en utvecklare.

Kör bygget härifrån och inte för hand i Git Bash. MSYS översätter argument som
ser ut som sökvägar, så `--base-href /RabattRecept/` blir
`C:/Program Files/Git/RabattRecept/` och appen får en base href som pekar rakt
ut i tomma intet. Skriptet anropar npx utan skal och undgår det.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"


def run(args, cwd=ROOT):
    subprocess.run(args, cwd=cwd, check=True)


def capture(args, cwd=ROOT):
    return subprocess.run(
        args, cwd=cwd, check=True, capture_output=True, text=True
    ).stdout.strip()


def repo_name():
    """Reponamnet ur origin, eftersom base href måste matcha underkatalogen."""
    url = capture(["git", "remote", "get-url", "origin"])
    match = re.search(r"[/:]([^/]+?)(?:\.git)?$", url)
    if not match:
        raise SystemExit(f"kunde inte läsa reponamnet ur {url!r}")
    return match.group(1)


def build(name):
    # npx ligger som .cmd på Windows och måste anropas med det namnet.
    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    print(f"bygger med base href /{name}/")
    run(
        [
            npx,
            "--no-install",
            "ng",
            "build",
            "--base-href",
            f"/{name}/",
            "--output-path",
            "docs",
        ]
    )

    if not (DOCS / "index.html").exists():
        raise SystemExit(f"bygget saknar index.html i {DOCS}")

    # Bygget tömmer katalogen, så .nojekyll måste skrivas efteråt. Utan den kör
    # Pages filerna genom Jekyll först, som hoppar över allt som börjar med _.
    (DOCS / ".nojekyll").touch()


def main():
    build(repo_name())

    if capture(["git", "status", "--porcelain", "docs"]):
        print("docs/ uppdaterad — committa och pusha")
    else:
        print("inget nytt att publicera, docs/ är redan aktuell")


if __name__ == "__main__":
    main()
