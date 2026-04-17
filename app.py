"""Local web app that rewrites workplace emails with Claude.

Run:  python app.py
Open: http://127.0.0.1:5000
"""

from __future__ import annotations

import os
import sys
import threading
import webbrowser
from pathlib import Path

from flask import Flask, jsonify, render_template, request

MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 2048
PROFILE_PATH = Path(__file__).parent / "profile.md"

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

app = Flask(__name__)


def read_profile() -> str:
    if not PROFILE_PATH.exists():
        return ""
    return PROFILE_PATH.read_text(encoding="utf-8")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/profile", methods=["GET"])
def get_profile():
    return jsonify({"content": read_profile()})


@app.route("/api/profile", methods=["PUT"])
def save_profile():
    data = request.get_json(silent=True) or {}
    content = data.get("content", "")
    if not isinstance(content, str):
        return jsonify({"error": "content must be a string"}), 400
    PROFILE_PATH.write_text(content, encoding="utf-8")
    return jsonify({"ok": True})


@app.route("/api/rewrite", methods=["POST"])
def rewrite():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return jsonify(
            {"error": "ANTHROPIC_API_KEY is not set on the server. See README."}
        ), 500

    data = request.get_json(silent=True) or {}
    draft = (data.get("draft") or "").strip()
    if not draft:
        return jsonify({"error": "Draft is empty."}), 400

    try:
        from anthropic import Anthropic
    except ImportError:
        return jsonify({"error": "anthropic SDK not installed. Run: pip install -e ."}), 500

    profile = read_profile().strip() or "(no profile provided)"
    system_text = SYSTEM_TEMPLATE.format(profile=profile)

    client = Anthropic()
    try:
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
    except Exception as e:
        return jsonify({"error": f"Claude API error: {e}"}), 502

    parts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
    revised = "".join(parts).strip()
    usage = response.usage
    return jsonify(
        {
            "revised": revised,
            "usage": {
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", 0) or 0,
                "cache_creation_input_tokens": getattr(usage, "cache_creation_input_tokens", 0) or 0,
            },
        }
    )


def _open_browser(url: str) -> None:
    try:
        webbrowser.open(url)
    except Exception:
        pass


def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5000"))
    url = f"http://{host}:{port}"

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "WARNING: ANTHROPIC_API_KEY is not set. The page will load, "
            "but rewrite requests will fail until you set it.",
            file=sys.stderr,
        )

    # Only open the browser on the real run, not on Flask's reloader child.
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        threading.Timer(1.0, _open_browser, args=(url,)).start()

    print(f"fix-email running at {url}")
    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    main()
