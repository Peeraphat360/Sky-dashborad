"""Brand palette (SkyCarPark — sky-blue + gold luxury accents) and shared
Flex building blocks: logo medallion, gold divider, bilingual rows."""
from __future__ import annotations

# ── Palette ──────────────────────────────────────────────
PRIMARY = "#0369a1"        # sky-700
PRIMARY_DARK = "#0c4a6e"   # sky-900
ACCENT = "#0284c7"         # sky-600
GOLD = "#d4af37"           # luxury accent
SURFACE_LIGHT = "#f0f9ff"  # sky-50
SUBTLE_ON_PRIMARY = "#bfe0f5"
TEXT_DARK = "#0f172a"      # slate-900
TEXT_GREY = "#64748b"      # slate-500
TEXT_FAINT = "#94a3b8"     # slate-400
SUCCESS = "#047857"        # emerald-700
SUCCESS_BG = "#e7f6ef"
HAIRLINE = "#eef2f6"

# Gradient for the hero header (gives depth)
HEADER_GRADIENT = {
    "type": "linearGradient",
    "angle": "160deg",
    "startColor": "#0b3a57",
    "endColor": "#0284c7",
}


def logo_badge(logo_url: str) -> dict:
    """White rounded medallion holding the logo — makes the blue logo pop on the
    gradient header and reads as a premium app-icon."""
    return {
        "type": "box",
        "layout": "vertical",
        "alignItems": "center",
        "contents": [
            {
                "type": "box",
                "layout": "vertical",
                "width": "96px",
                "height": "96px",
                "backgroundColor": "#ffffff",
                "cornerRadius": "22px",
                "justifyContent": "center",
                "alignItems": "center",
                "paddingAll": "12px",
                "contents": [
                    {"type": "image", "url": logo_url, "size": "full", "aspectMode": "fit"}
                ],
            }
        ],
    }


def gold_divider() -> dict:
    """Short centered gold line — luxury accent under the title."""
    return {
        "type": "box",
        "layout": "vertical",
        "alignItems": "center",
        "margin": "md",
        "contents": [
            {
                "type": "box",
                "layout": "vertical",
                "width": "46px",
                "height": "3px",
                "backgroundColor": GOLD,
                "cornerRadius": "3px",
                "contents": [{"type": "filler"}],
            }
        ],
    }


def bi_row(label_th: str, label_en: str, value: str, *,
           sub_value: str | None = None,
           value_color: str = TEXT_DARK) -> dict:
    """A bilingual info line: Thai label (+ English sub-label) on the left,
    bold value (with optional second line) on the right."""
    if sub_value:
        value_node = {
            "type": "box", "layout": "vertical", "flex": 7,
            "contents": [
                {"type": "text", "text": value, "align": "end", "size": "sm",
                 "color": value_color, "weight": "bold", "wrap": True},
                {"type": "text", "text": sub_value, "align": "end", "size": "xs",
                 "color": TEXT_FAINT},
            ],
        }
    else:
        value_node = {
            "type": "text", "text": value, "flex": 7, "align": "end", "size": "sm",
            "color": value_color, "weight": "bold", "wrap": True, "gravity": "center",
        }

    return {
        "type": "box",
        "layout": "horizontal",
        "margin": "lg",
        "alignItems": "center",
        "contents": [
            {
                "type": "box", "layout": "vertical", "flex": 5,
                "contents": [
                    {"type": "text", "text": label_th, "size": "sm", "color": TEXT_GREY},
                    {"type": "text", "text": label_en, "size": "xxs", "color": TEXT_FAINT},
                ],
            },
            value_node,
        ],
    }


def hairline(margin: str = "lg") -> dict:
    return {"type": "separator", "margin": margin, "color": HAIRLINE}
