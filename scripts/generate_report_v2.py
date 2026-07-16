from __future__ import annotations

import os
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

import generate_report as base

ITEMS_PER_SECTION = 8
QUICK_SCAN_LIMIT = 8
MAX_PER_SOURCE = 3
TAYLOR_FASHION_SECTION_LIMIT = 2
TAYLOR_FASHION_QUICK_SCAN_LIMIT = 1
PREFERENCE_PROFILE_URL = os.getenv(
    "PREFERENCE_PROFILE_URL",
    "https://mymorningintelligencereport.netlify.app/api/feedback",
)
MAX_PREFERENCE_BONUS = 18.0

ALLOWED_SPORTS_PHRASES = {
    "green bay packers",
    "packers",
    "wisconsin badgers",
    "uw badgers",
    "badgers football",
    "badgers basketball",
    "wisconsin football",
    "wisconsin basketball",
}

UNWANTED_SPORTS_TERMS = {
    "baseball",
    "mlb",
    "world series",
    "home run",
    "pitcher",
    "football",
    "nfl",
    "super bowl",
    "touchdown",
    "quarterback",
    "golf",
    "pga",
    "masters tournament",
    "basketball",
    "nba",
    "wnba",
    "march madness",
    "hockey",
    "nhl",
    "soccer",
    "mls",
    "premier league",
    "tennis",
    "wimbledon",
    "cricket",
    "formula 1",
    "nascar",
    "olympics",
    "playoff",
    "playoffs",
    "championship",
    "sports betting",
}

TAYLOR_FASHION_TERMS = {
    "dress",
    "gown",
    "outfit",
    "fashion",
    "style",
    "styled",
    "wears",
    "wore",
    "wearing",
    "red carpet",
    "jewelry",
    "boots",
    "makeup",
    "hair",
}

# Give the entertainment pool a feed that specifically hunts for Taylor fashion news.
base.FEEDS["entertainment"].insert(
    0,
    (
        "Taylor Fashion",
        base.google_news(
            '"Taylor Swift" (dress OR gown OR outfit OR fashion OR style OR wearing) when:7d'
        ),
    ),
)
base.ITEMS_PER_SECTION = ITEMS_PER_SECTION
base.MAX_PER_SOURCE = MAX_PER_SOURCE


def text_for(item: dict[str, Any]) -> str:
    return f"{item.get('headline', '')} {item.get('summary', '')}".lower()


def load_preference_profile() -> dict[str, Any]:
    """Load the aggregate preference profile without making report generation depend on it."""
    if not PREFERENCE_PROFILE_URL:
        return {}

    request = Request(
        PREFERENCE_PROFILE_URL,
        headers={"User-Agent": "Morning-Intelligence-Report/1.0"},
    )
    try:
        with urlopen(request, timeout=6) as response:
            payload = base.json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, ValueError, base.json.JSONDecodeError) as error:
        print(f"Preference profile unavailable; using editorial ranking only: {error}")
        return {}

    if not isinstance(payload, dict):
        return {}

    total = int(payload.get("total_signals") or 0)
    print(f"Loaded preference profile with {total} active feedback signals.")
    return payload


def numeric_map(profile: dict[str, Any], field: str) -> dict[str, float]:
    raw = profile.get(field)
    if not isinstance(raw, dict):
        return {}
    cleaned: dict[str, float] = {}
    for map_key, value in raw.items():
        try:
            cleaned[str(map_key).lower()] = float(value)
        except (TypeError, ValueError):
            continue
    return cleaned


def preference_bonus(item: dict[str, Any], profile: dict[str, Any]) -> float:
    if not profile:
        return 0.0

    section_weights = numeric_map(profile, "section_weights")
    source_weights = numeric_map(profile, "source_weights")
    keyword_weights = numeric_map(profile, "keyword_weights")

    bonus = section_weights.get(str(item.get("section", "")).lower(), 0.0)
    bonus += source_weights.get(str(item.get("source", "")).lower(), 0.0)

    text = text_for(item)
    keyword_bonus = 0.0
    for keyword, weight in keyword_weights.items():
        if not keyword:
            continue
        if " " in keyword:
            matched = keyword in text
        else:
            matched = re.search(
                rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])",
                text,
            ) is not None
        if matched:
            keyword_bonus += weight

    # Feedback should steer the report, not bulldoze editorial importance and recency.
    keyword_bonus = max(-12.0, min(12.0, keyword_bonus))
    bonus += keyword_bonus
    return max(-MAX_PREFERENCE_BONUS, min(MAX_PREFERENCE_BONUS, bonus))


def is_allowed_sports_story(text: str) -> bool:
    return any(phrase in text for phrase in ALLOWED_SPORTS_PHRASES)


def is_unwanted_sports_story(item: dict[str, Any]) -> bool:
    text = text_for(item)
    if is_allowed_sports_story(text):
        return False
    return any(base.contains_term(text, term) for term in UNWANTED_SPORTS_TERMS)


def is_taylor_fashion_story(item: dict[str, Any]) -> bool:
    text = text_for(item)
    return "taylor swift" in text and any(term in text for term in TAYLOR_FASHION_TERMS)


def display_score(
    item: dict[str, Any],
    now_ts: float,
    profile: dict[str, Any] | None = None,
) -> float:
    score = base.importance_score(item, now_ts)
    if item.get("image"):
        score += 4
    if is_taylor_fashion_story(item):
        # Keep Taylor fashion discoverable without allowing it to dominate the report.
        score += 6
    score += preference_bonus(item, profile or {})
    return score


def collect_filtered(
    now_ts: float,
    profile: dict[str, Any],
) -> dict[str, list[dict[str, Any]]]:
    pools = base.collect_all(now_ts)
    for section, stories in pools.items():
        filtered = [story for story in stories if not is_unwanted_sports_story(story)]
        filtered.sort(
            key=lambda item: (
                display_score(item, now_ts, profile),
                item.get("timestamp", 0),
            ),
            reverse=True,
        )
        pools[section] = filtered
    return pools


def limit_taylor_fashion(
    candidates: list[dict[str, Any]],
    limit: int,
) -> list[dict[str, Any]]:
    limited: list[dict[str, Any]] = []
    taylor_count = 0
    for item in candidates:
        if is_taylor_fashion_story(item):
            if taylor_count >= limit:
                continue
            taylor_count += 1
        limited.append(item)
    return limited


def choose_with_backfill(
    candidates: list[dict[str, Any]],
    limit: int,
    global_chosen: list[dict[str, Any]],
    history: list[dict[str, str]],
    today: str,
) -> list[dict[str, Any]]:
    selected = base.choose_diverse(candidates, limit, global_chosen, history, today)
    if len(selected) >= limit:
        return selected

    source_counts: Counter[str] = Counter(item["source"] for item in selected)
    for item in candidates:
        if item in selected:
            continue
        if source_counts[item["source"]] >= MAX_PER_SOURCE:
            continue
        if base.is_duplicate(item, global_chosen + selected):
            continue
        selected.append(item)
        source_counts[item["source"]] += 1
        if len(selected) >= limit:
            break
    return selected


def public_story(item: dict[str, Any] | None) -> dict[str, Any] | None:
    story = base.public_story(item)
    if isinstance(story, dict):
        story.pop("take", None)
    return story


def choose_top_story(
    pools: dict[str, list[dict[str, Any]]],
    history: list[dict[str, str]],
    today: str,
    now_ts: float,
    profile: dict[str, Any],
) -> dict[str, Any] | None:
    # The Big Story is reserved for consequential local, national, global, AI,
    # or technology news. Entertainment stories, including Taylor Swift, never
    # enter the lead-story pool.
    top_pool = [
        item
        for item in (
            pools.get("must-know", [])
            + pools.get("local", [])
            + pools.get("ai-tech", [])
        )
        if "taylor swift" not in text_for(item)
    ]
    for item in top_pool:
        item["score"] = display_score(item, now_ts, profile)
    top_pool.sort(
        key=lambda item: (item["score"], item.get("timestamp", 0)),
        reverse=True,
    )

    fresh_top = [
        item for item in top_pool if not base.appeared_before(item, history, today)
    ]
    return fresh_top[0] if fresh_top else (top_pool[0] if top_pool else None)


def main() -> None:
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(base.REPORT_TZ)
    now_ts = now_utc.timestamp()
    today = now_local.date().isoformat()
    history = base.load_history(now_local)
    preference_profile = load_preference_profile()
    pools = collect_filtered(now_ts, preference_profile)

    chosen_global: list[dict[str, Any]] = []
    sections: dict[str, list[dict[str, Any]]] = {}

    top_story = choose_top_story(
        pools,
        history,
        today,
        now_ts,
        preference_profile,
    )
    if top_story:
        chosen_global.append(top_story)

    for section in base.SECTION_ORDER:
        candidates = [
            item
            for item in pools.get(section, [])
            if not top_story or item["url"] != top_story["url"]
        ]
        if section == "entertainment":
            candidates = limit_taylor_fashion(
                candidates,
                TAYLOR_FASHION_SECTION_LIMIT,
            )

        selected = choose_with_backfill(
            candidates,
            ITEMS_PER_SECTION,
            chosen_global,
            history,
            today,
        )
        chosen_global.extend(selected)
        sections[section] = [
            public_story(item) for item in selected if public_story(item)
        ]

    quick_candidates: list[dict[str, Any]] = []
    for section in base.SECTION_ORDER:
        quick_candidates.extend(pools.get(section, [])[:12])
    quick_candidates.sort(
        key=lambda item: (
            display_score(item, now_ts, preference_profile),
            item.get("timestamp", 0),
        ),
        reverse=True,
    )
    quick_candidates = limit_taylor_fashion(
        quick_candidates,
        TAYLOR_FASHION_QUICK_SCAN_LIMIT,
    )
    quick_scan = choose_with_backfill(
        quick_candidates,
        QUICK_SCAN_LIMIT,
        chosen_global,
        history,
        today,
    )

    report = {
        "generated_at": now_utc.isoformat(),
        "generated_at_local": now_local.isoformat(),
        "report_date": today,
        "top_story": public_story(top_story),
        "quick_scan": [public_story(item) for item in quick_scan if public_story(item)],
        "sections": sections,
        "wonderful": sections["wonderful"][0] if sections["wonderful"] else None,
        "capybara_message": base.choose_clementine(now_local),
        "personalization": {
            "active_feedback_signals": int(preference_profile.get("total_signals") or 0),
            "profile_updated_at": preference_profile.get("updated_at"),
        },
    }

    base.OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    base.OUTPUT_PATH.write_text(
        base.json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    base.write_history(history, report, now_local)
    print(
        f"Wrote {base.OUTPUT_PATH} for {today} with "
        f"{sum(len(items) for items in sections.values())} section stories"
    )


if __name__ == "__main__":
    main()
