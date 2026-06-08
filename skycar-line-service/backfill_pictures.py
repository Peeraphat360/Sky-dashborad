"""One-off / re-runnable backfill: pull each LINE customer's profile picture
from the Messaging API (GET /v2/bot/profile/{userId}) and store it in
users.picture_url. Only works for customers who added the OA as a friend.

Run:  python backfill_pictures.py
"""
from __future__ import annotations

import re
import sys
import httpx

ENV = ".env"


def load_env() -> dict:
    cfg = {}
    for line in open(ENV, encoding="utf-8"):
        m = re.match(r"^([A-Z_]+)=(.*)$", line.strip())
        if m:
            cfg[m.group(1)] = m.group(2).strip()
    return cfg


def main() -> None:
    cfg = load_env()
    url = cfg["SUPABASE_URL"]
    key = cfg["SUPABASE_SERVICE_ROLE_KEY"]
    token = cfg["LINE_CHANNEL_ACCESS_TOKEN"]
    sb = {"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"}
    line_h = {"Authorization": f"Bearer {token}"}

    # users that have a LINE id (candidates)
    r = httpx.get(
        f"{url}/rest/v1/users",
        params={"select": "id,line_user_id,picture_url", "line_user_id": "not.is.null"},
        headers=sb, timeout=30,
    )
    users = r.json()
    print(f"candidates with line_user_id: {len(users)}")

    updated = skipped = not_friend = 0
    with httpx.Client(timeout=20) as client:
        for u in users:
            lid = u["line_user_id"]
            pr = client.get(f"https://api.line.me/v2/bot/profile/{lid}", headers=line_h)
            if pr.status_code != 200:
                not_friend += 1
                continue
            pic = pr.json().get("pictureUrl")
            if not pic:
                skipped += 1
                continue
            if u.get("picture_url") == pic:
                skipped += 1
                continue
            up = client.patch(
                f"{url}/rest/v1/users",
                params={"id": f"eq.{u['id']}"},
                headers=sb, json={"picture_url": pic},
            )
            if up.status_code in (200, 204):
                updated += 1
            else:
                print("  update failed:", up.status_code, up.text[:120])

    print(f"done — updated={updated}  skipped={skipped}  not_friend/unreachable={not_friend}")


if __name__ == "__main__":
    sys.exit(main())
