"""Clipboard-driven email rewriter.

Reads a draft email from the system clipboard, sends it to Claude with the
user's profile as context, and writes the cleaned-up version back to the
clipboard (and prints it to stdout).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2048

SYSTEM_TEMPLATE = """You are an email editor for a professional workplace writer. Rewrite the user's draft email so it is:
1. Grammatically correct and natural English.
2. Concise — remove filler, redundancy, and hedging. Preserve every fact, name, number, date, and request.
3. Polite and courteous — warm, respectful, professional tone suitable for colleagues, clients, and managers.

Rules:
- Output ONLY the rewritten email body. No preamble, no explanation, no markdown fences.
- Preserve the user's intent and every specific ask.
- Keep greeting and sign-off if present; add a simple one only if it is clearly missing.
- Do not invent facts, commitments, names, or dates.
- Match the original language (English).

User profile (use for tone, names, role, common recipients):
<profile>
{profile}
</profile>"""


def die(msg: str, code: int = 1) -> None:
    print(f"fix-email: {msg}", file=sys.stderr)
    sys.exit(code)


def load_profile() -> str:
    profile_path = Path(__file__).parent / "profile.md"
    if not profile_path.exists():
        print(
            f"fix-email: warning — {profile_path} not found; running without profile.",
            file=sys.stderr,
        )
        return "(no profile provided)"
    return profile_path.read_text(encoding="utf-8").strip() or "(profile is empty)"


def read_clipboard() -> str:
    try:
        import pyperclip
    except ImportError:
        die("pyperclip not installed. Run: pip install -e .")

    try:
        draft = pyperclip.paste()
    except pyperclip.PyperclipException as e:
        die(
            "Could not read clipboard. On Linux, install a backend first:\n"
            "  sudo apt install xclip   # or xsel, or wl-clipboard\n"
            f"Underlying error: {e}"
        )

    if not draft or not draft.strip():
        die("Clipboard is empty. Copy your draft email first.")
    return draft


def write_clipboard(text: str) -> None:
    import pyperclip

    pyperclip.copy(text)


def rewrite(draft: str, profile: str) -> tuple[str, object]:
    try:
        from anthropic import Anthropic
    except ImportError:
        die("anthropic SDK not installed. Run: pip install -e .")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        die("ANTHROPIC_API_KEY is not set. Export it first: export ANTHROPIC_API_KEY=sk-ant-...")

    client = Anthropic()
    system_text = SYSTEM_TEMPLATE.format(profile=profile)

    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=[
            {
                "type": "text",
                "text": system_text,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": draft}],
    )

    parts = [block.text for block in response.content if getattr(block, "type", None) == "text"]
    return "".join(parts).strip(), response.usage


def main() -> None:
    draft = read_clipboard()
    profile = load_profile()
    revised, usage = rewrite(draft, profile)

    if not revised:
        die("Model returned an empty response.")

    write_clipboard(revised)
    print(revised)

    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
    cache_write = getattr(usage, "cache_creation_input_tokens", 0) or 0
    print(
        f"\n[fix-email] copied to clipboard · "
        f"input={usage.input_tokens} output={usage.output_tokens} "
        f"cache_read={cache_read} cache_write={cache_write}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
