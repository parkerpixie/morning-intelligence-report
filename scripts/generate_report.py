from __future__ import annotations

import html
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

import feedparser

OUTPUT_PATH = Path("data/report.json")
ITEMS_PER_SECTION = 4
MAX_PER_SOURCE = 2


def google_news(query: str) -> str:
    return f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"


FEEDS: dict[str, list[tuple[str, str]]] = {
    "local": [
        ("Wisconsin Public Radio", "https://www.wpr.org/feed"),
        ("Madison Local", google_news("Madison Wisconsin news when:2d")),
        ("Wisconsin News", google_news("Wisconsin news when:2d")),
        ("Dane County", google_news("Dane County Madison news when:3d")),
    ],
    "must-know": [
        ("NPR", "https://feeds.npr.org/1001/rss.xml"),
        ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
        ("BBC US & Canada", "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"),
        ("Reuters via Google News", google_news("Reuters top news when:1d")),
        ("AP via Google News", google_news("Associated Press top news when:1d")),
    ],
    "ai-tech": [
        ("MIT Technology Review", "https://www.technologyreview.com/feed/"),
        ("BBC Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml"),
        ("The Verge", "https://www.theverge.com/rss/index.xml"),
        ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"),
        ("AI News", google_news("artificial intelligence OpenAI Anthropic Google AI when:2d")),
    ],
    "work-marketing": [
        ("MarTech", "https://martech.org/feed/"),
        ("HubSpot Marketing", "https://blog.hubspot.com/marketing/rss.xml"),
        ("Marketing Brew", "https://www.marketingbrew.com/feed"),
        ("Salesforce", google_news("Salesforce marketing automation CRM when:7d")),
        ("Marketing Ops", google_news("marketing operations automation analytics when:7d")),
    ],
    "wellbeing": [
        ("BBC Health", "https://feeds.bbci.co.uk/news/health/rss.xml"),
        ("ScienceDaily Mind & Brain", "https://www.sciencedaily.com/rss/mind_brain.xml"),
        ("NIMH", "https://www.nimh.nih.gov/site-info/index-rss"),
        ("Mental Health", google_news("mental health psychology ADHD autism research when:3d")),
        ("Behavioral Health", google_news("behavioral health technology EHR therapy when:7d")),
    ],
    "entertainment": [
        ("Taylor Alert", google_news('"Taylor Swift" when:7d')),
        ("Variety", "https://variety.com/feed/"),
        ("BBC Entertainment", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"),
        ("NPR Music", "https://feeds.npr.org/1039/rss.xml"),
        ("Pitchfork", "https://pitchfork.com/rss/news/"),
    ],
    "animals": [
        ("Smithsonian", "https://www.smithsonianmag.com/rss/smart-news/"),
        ("BBC Science", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"),
        ("Animals", google_news("animals pets wildlife rescue science when:3d")),
    ],
    "wonderful": [
        ("Good News Network", "https://www.goodnewsnetwork.org/feed/"),
        ("Positive News", "https://www.positive.news/feed/"),
        ("Wonderful News", google_news("uplifting inspiring community rescue kindness when:3d")),
    ],
}

TAKES = {
    "local": "This is close enough to affect your actual week, not merely your opinion of the internet.",
    "must-know": "This is one of the stories most likely to shape today’s conversations, decisions, or consequences.",
    "ai-tech": "The useful question is whether this changes how people work, create, access information, or hand power to a platform.",
    "work-marketing": "Look for the operational consequence: better data, smarter automation, clearer measurement, or another shiny dashboard demanding snacks.",
    "wellbeing": "Read the evidence carefully and keep the nuance. Health headlines are not personalized medical advice.",
    "entertainment": "Culture matters because attention is a real economy. Also, Taylor mentions qualify as infrastructure.",
    "animals": "Creatures remain undefeated at making science more interesting and humans slightly less self-important.",
    "wonderful": "Keep this one. The internet has extracted enough rent from your nervous system today.",
}

CAPYBARA_MESSAGES = [
    "You do not have to solve the whole forest before breakfast. Find the next clear step and put one paw there.",
    "Urgency is often just anxiety wearing a tiny management badge. Breathe before you promote it.",
    "A steady morning is not wasted time. Roots are doing work even when nobody applauds them.",
    "Protect your attention. It is a garden, not a public parking lot.",
    "You are allowed to begin with the task that makes the rest of the day feel less haunted.",
]


def clean_text(value: str | None, limit: int = 430) -> str:
    if not value:
        return "Open the original source for the full details."
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) <= limit:
        return value
    return f"{value[:limit].rsplit(' ', 1)[0]}…"


def entry_timestamp(entry: Any) -> float:
    parsed = entry.get("published_parsed") or entry.get("updated_parsed")
    if not parsed:
        return 0
    return datetime(*parsed[:6], tzinfo=timezone.utc).timestamp()


def image_from_entry(entry: Any) -> str:
    for key in ("media_content", "media_thumbnail"):
        media = entry.get(key) or []
        for item in media:
            url = item.get("url")
            if url:
                return url
    for enclosure in entry.get("enclosures", []) or []:
        href = enclosure.get("href") or enclosure.get("url")
        media_type = enclosure.get("type", "")
        if href and ("image" in media_type or re.search(r"\.(jpe?g|png|webp)(\?|$)", href, re.I)):
            return href
    raw = entry.get("summary") or entry.get("description") or ""
    match = re.search(r'<img[^>]+src=["\']([^"\']+)', raw, re.I)
    return html.unescape(match.group(1)) if match else ""


def title_tokens(title: str) -> set[str]:
    stop = {"the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "as", "is", "are", "from", "at", "by", "after", "new", "says"}
    return {word for word in re.findall(r"[a-z0-9]+", title.lower()) if len(word) > 2 and word not in stop}


def is_duplicate(candidate: dict[str, Any], chosen: list[dict[str, Any]]) -> bool:
    candidate_tokens = title_tokens(candidate["headline"])
    for item in chosen:
        if candidate["url"] == item["url"]:
            return True
        existing_tokens = title_tokens(item["headline"])
        union = candidate_tokens | existing_tokens
        similarity = len(candidate_tokens & existing_tokens) / len(union) if union else 0
        if similarity >= 0.56:
            return True
    return False


def collect_all() -> dict[str, list[dict[str, Any]]]:
    results: dict[str, list[dict[str, Any]]] = {section: [] for section in FEEDS}
    for section, feeds in FEEDS.items():
        for source_name, url in feeds:
            feed = feedparser.parse(url)
            for entry in feed.entries[:14]:
                link = (entry.get("link") or "").strip()
                headline = clean_text(entry.get("title"), 190)
                if not link or not headline:
                    continue
                results[section].append({
                    "section": section,
                    "source": source_name,
                    "headline": headline,
                    "summary": clean_text(entry.get("summary") or entry.get("description")),
                    "take": TAKES[section],
                    "url": link,
                    "image": image_from_entry(entry),
                    "timestamp": entry_timestamp(entry),
                    "published": clean_text(entry.get("published") or entry.get("updated"), 80),
                })
        results[section].sort(key=lambda item: item["timestamp"], reverse=True)
    return results


def choose_diverse(candidates: list[dict[str, Any]], limit: int, global_chosen: list[dict[str, Any]]) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    source_counts: Counter[str] = Counter()
    for item in candidates:
        if source_counts[item["source"]] >= MAX_PER_SOURCE:
            continue
        if is_duplicate(item, global_chosen + selected):
            continue
        selected.append(item)
        source_counts[item["source"]] += 1
        if len(selected) >= limit:
            break
    return selected


def public_story(item: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in item.items() if key not in {"timestamp", "section"}}


def main() -> None:
    now = datetime.now(timezone.utc)
    pools = collect_all()
    chosen_global: list[dict[str, Any]] = []
    sections: dict[str, list[dict[str, Any]]] = {}

    section_order = ["local", "must-know", "ai-tech", "work-marketing", "wellbeing", "entertainment", "animals", "wonderful"]
    for section in section_order:
        selected = choose_diverse(pools[section], ITEMS_PER_SECTION, chosen_global)
        chosen_global.extend(selected)
        sections[section] = [public_story(item) for item in selected]

    top_pool = pools["must-know"] + pools["local"] + pools["ai-tech"]
    top_pool.sort(key=lambda item: (1 if item.get("image") else 0, item["timestamp"]), reverse=True)
    top_story = next((item for item in top_pool if not is_duplicate(item, [])), None)
    if top_story:
        chosen_global.insert(0, top_story)
        for stories in sections.values():
            stories[:] = [story for story in stories if story.get("url") != top_story.get("url")]

    quick_scan_candidates = []
    for section in section_order:
        quick_scan_candidates.extend(pools[section][:4])
    quick_scan_candidates.sort(key=lambda item: item["timestamp"], reverse=True)
    quick_scan = choose_diverse(quick_scan_candidates, 9, chosen_global)

    report = {
        "generated_at": now.isoformat(),
        "report_date": now.strftime("%Y-%m-%d"),
        "top_story": public_story(top_story) if top_story else None,
        "quick_scan": [public_story(item) for item in quick_scan],
        "sections": sections,
        "wonderful": sections["wonderful"][0] if sections["wonderful"] else None,
        "capybara_message": CAPYBARA_MESSAGES[now.toordinal() % len(CAPYBARA_MESSAGES)],
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {sum(len(items) for items in sections.values())} section stories")


if __name__ == "__main__":
    main()
