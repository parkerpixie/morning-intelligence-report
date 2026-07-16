from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any

import generate_report as base

ITEMS_PER_SECTION = 8
QUICK_SCAN_LIMIT = 8
MAX_PER_SOURCE = 3

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


def display_score(item: dict[str, Any], now_ts: float) -> float:
    score = base.importance_score(item, now_ts)
    if item.get("image"):
        score += 4
    if is_taylor_fashion_story(item):
        score += 100
    return score


def collect_filtered(now_ts: float) -> dict[str, list[dict[str, Any]]]:
    pools = base.collect_all(now_ts)
    for section, stories in pools.items():
        filtered = [story for story in stories if not is_unwanted_sports_story(story)]
        filtered.sort(
            key=lambda item: (display_score(item, now_ts), item.get("timestamp", 0)),
            reverse=True,
        )
        pools[section] = filtered
    return pools


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
) -> dict[str, Any] | None:
    taylor_fashion = [
        item
        for item in pools.get("entertainment", [])
        if is_taylor_fashion_story(item) and not base.appeared_before(item, history, today)
    ]
    if taylor_fashion:
        taylor_fashion.sort(
            key=lambda item: (bool(item.get("image")), item.get("timestamp", 0)),
            reverse=True,
        )
        return taylor_fashion[0]

    top_pool = (
        pools.get("must-know", [])
        + pools.get("local", [])
        + pools.get("ai-tech", [])
        + [item for item in pools.get("entertainment", []) if "taylor swift" in text_for(item)]
    )
    for item in top_pool:
        item["score"] = display_score(item, now_ts)
    top_pool.sort(key=lambda item: (item["score"], item.get("timestamp", 0)), reverse=True)

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
    pools = collect_filtered(now_ts)

    chosen_global: list[dict[str, Any]] = []
    sections: dict[str, list[dict[str, Any]]] = {}

    top_story = choose_top_story(pools, history, today, now_ts)
    if top_story:
        chosen_global.append(top_story)

    for section in base.SECTION_ORDER:
        candidates = [
            item
            for item in pools.get(section, [])
            if not top_story or item["url"] != top_story["url"]
        ]
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
        key=lambda item: (display_score(item, now_ts), item.get("timestamp", 0)),
        reverse=True,
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
