"""Bygger appen och lägger resultatet i grenen gh-pages.

Körs med `python tools/build-pages.py`. Arbetskatalogen och grenen du står på
lämnas orörda: grenen uppdateras i ett tillfälligt git-arbetsträd. Pusha sedan
med `git push origin gh-pages`.

Kör bygget härifrån och inte för hand i Git Bash. MSYS översätter argument som
ser ut som sökvägar, så `--base-href /RabattRecept/` blir
`C:/Program Files/Git/RabattRecept/` och appen får en base href som pekar rakt
ut i tomma intet. Skriptet anropar npx utan skal och undgår det.
"""
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist" / "rabatt-recept"
BRANCH = "gh-pages"


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
    run([npx, "--no-install", "ng", "build", "--base-href", f"/{name}/"])

    if not (DIST / "index.html").exists():
        raise SystemExit(f"bygget saknar index.html i {DIST}")


def branch_exists():
    return (
        subprocess.run(
            ["git", "rev-parse", "--verify", BRANCH], cwd=ROOT, capture_output=True
        ).returncode
        == 0
    )


def clear(directory):
    for item in directory.iterdir():
        if item.name == ".git":
            continue
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()


def publish():
    # git worktree add kräver att katalogen inte finns än.
    worktree = Path(tempfile.mkdtemp(prefix="pages-"))
    shutil.rmtree(worktree)

    try:
        if branch_exists():
            run(["git", "worktree", "add", str(worktree), BRANCH])
        else:
            run(["git", "worktree", "add", "--detach", str(worktree)])
            run(["git", "checkout", "--orphan", BRANCH], cwd=worktree)
            # Grenen ska bara innehålla bygget, inte källkoden från HEAD.
            run(["git", "rm", "-rq", "--cached", "."], cwd=worktree)

        clear(worktree)
        shutil.copytree(DIST, worktree, dirs_exist_ok=True)
        # Utan .nojekyll kör Pages filerna genom Jekyll först.
        (worktree / ".nojekyll").touch()

        run(["git", "add", "-A"], cwd=worktree)
        if not capture(["git", "status", "--porcelain"], cwd=worktree):
            print("inget nytt att publicera, grenen är redan aktuell")
            return

        run(["git", "commit", "-q", "-m", "Byggd app för GitHub Pages"], cwd=worktree)
        print(f"grenen {BRANCH} uppdaterad")
        print(f"pusha med: git push origin {BRANCH}")
    finally:
        subprocess.run(
            ["git", "worktree", "remove", str(worktree), "--force"],
            cwd=ROOT,
            capture_output=True,
        )


if __name__ == "__main__":
    build(repo_name())
    publish()
