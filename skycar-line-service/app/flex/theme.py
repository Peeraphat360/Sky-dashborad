"""Brand palette (matches the SkyCarPark website — sky-blue theme) + shared row helper."""
from __future__ import annotations

# Sky Car Park brand colors
PRIMARY = "#0369a1"        # sky-700  — header / totals
PRIMARY_DARK = "#0c4a6e"   # sky-900  — gradients / emphasis
ACCENT = "#0284c7"         # sky-600
SURFACE_LIGHT = "#f0f9ff"  # sky-50   — soft background
SUBTLE_ON_PRIMARY = "#cce4f5"  # light blue text on the blue header
TEXT_DARK = "#0f172a"      # slate-900
TEXT_GREY = "#64748b"      # slate-500
SUCCESS = "#059669"        # emerald-600 — "ชำระเงินแล้ว"
SUCCESS_BG = "#e7f6ef"


def info_row(label: str, value: str, *,
             value_color: str = TEXT_DARK,
             value_size: str = "sm",
             value_weight: str = "bold") -> dict:
    """A label (left, grey) / value (right, dark bold) line."""
    return {
        "type": "box",
        "layout": "horizontal",
        "margin": "md",
        "contents": [
            {"type": "text", "text": label, "size": "sm", "color": TEXT_GREY, "flex": 4},
            {
                "type": "text", "text": value, "size": value_size, "color": value_color,
                "weight": value_weight, "align": "end", "flex": 6, "wrap": True,
            },
        ],
    }
