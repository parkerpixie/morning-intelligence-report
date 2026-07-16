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
        ("Reuters", google_news("Reuters top news when:1d")),
        ("Associated Press", google_news("Associated Press top news when:1d")),
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

SECTION_LABELS = {
    "local": "Local",
    "must-know": "Must Know",
    "ai-tech": "AI & Technology",
    "work-marketing": "Work & Marketing",
    "wellbeing": "Health & Psychology",
    "entertainment": "Entertainment",
    "animals": "Animals & Nature",
    "wonderful": "Something Wonderful",
}

ANIMAL_WORDS = {
    "animal", "animals", "dog", "dogs", "cat", "cats", "pet", "pets", "wildlife", "bird", "birds",
    "bear", "bears", "wolf", "wolves", "whale", "whales", "dolphin", "dolphins", "elephant", "elephants",
    "horse", "horses", "rabbit", "rabbits", "fox", "foxes", "otter", "otters", "capybara", "zoo",
    "species", "habitat", "conservation", "rescue", "shelter", "veterinary", "marine life", "insect", "insects",
}

IMPORTANT_WORDS = {
    "election": 6, "president": 6, "congress": 5, "supreme court": 6, "war": 6, "ceasefire": 6,
    "economy": 5, "inflation": 5, "jobs": 4, "interest rates": 5, "federal reserve": 5,
    "breaking": 5, "emergency": 6, "wildfire": 5, "flood": 5, "hurricane": 5, "tornado": 5,
    "law": 4, "policy": 4, "rights": 5, "abortion": 5, "lgbtq": 5, "education": 4,
    "openai": 4, "anthropic": 4, "artificial intelligence": 4, "cybersecurity": 4, "data breach": 5,
    "wisconsin": 3, "madison": 4, "dane county": 4, "uw-madison": 4,
    "taylor swift": 5,
}

SOURCE_WEIGHT = {
    "Reuters": 7,
    "Associated Press": 7,
    "NPR": 6,
    "BBC World": 6,
    "BBC US & Canada": 6,
    "Wisconsin Public Radio": 6,
    "MIT Technology Review": 5,
    "The Verge": 4,
    "Ars Technica": 4,
    "Variety": 4,
}


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
        for item in entry.get(key) or []:
            if item.get("url"):
                return item["url"]
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
        if similarity >= 0.48:
            return True
    return False


def looks_like_animal_story(text: str) -> bool:
    lowered = text.lower()
    return any(word in lowered for word in ANIMAL_WORDS)


def classify_section(original: str, headline: str, summary: str) -> str:
    text = f"{headline} {summary}".lower()

    if any(term in text for term in ("madison", "dane county", "wisconsin", "uw-madison", "milwaukee")):
        return "local"
    if "taylor swift" in text or any(term in text for term in ("album", "concert", "film", "movie", "television", "actor", "actress", "singer", "music", "netflix", "streaming")):
        return "entertainment"
    if any(term in text for term in ("openai", "anthropic", "artificial intelligence", " ai ", "technology", "cybersecurity", "software", "robot", "chip", "privacy")):
        return "ai-tech"
    if any(term in text for term in ("marketing", "salesforce", "hubspot", "crm", "customer experience", "automation", "analytics", "advertising", "brand")):
        return "work-marketing"
    if any(term in text for term in ("mental health", "psychology", "adhd", "autism", "therapy", "depression", "anxiety", "health", "medical", "hospital", "disease", "drug", "treatment")):
        return "wellbeing"
    if looks_like_animal_story(text):
        return "animals"
    if original == "wonderful":
        return "wonderful"
    return original if original != "animals" else "must-know"


def first_sentence(text: str, limit: int = 180) -> str:
    sentence = re.split(r"(?<=[.!?])\s+", text.strip())[0]
    sentence = sentence.rstrip(".")
    if len(sentence) > limit:
        sentence = sentence[:limit].rsplit(" ", 1)[0]
    return sentence


def make_take(section: str, headline: str, summary: str) -> str:
    text = f"{headline} {summary}".lower()
    detail = first_sentence(summary)

    if "taylor swift" in text:
        return f"Taylor alert: {detail}. The useful bit is whether this changes a release, tour, project, or the wider music conversation."
    if section == "local":
        return f"This is close enough to matter beyond the headline: {detail}. Watch for the practical effect on Madison, Dane County, or Wisconsin residents."
    if section == "must-know":
        if any(word in text for word in ("election", "congress", "court", "law", "policy", "president")):
            return f"The consequential part is not the political theater. It is what this could change in law, policy, rights, or public life: {detail}."
        if any(word in text for word in ("economy", "inflation", "jobs", "rates", "market")):
            return f"The real signal is what this may do to prices, jobs, borrowing, or household confidence: {detail}."
        return f"This made the cut because it could shape today’s wider conversation or consequences: {detail}."
    if section == "ai-tech":
        return f"The useful question is whether this changes how people work, create, protect data, or depend on a platform. Here, the key development is: {detail}."
    if section == "work-marketing":
        return f"For your work brain, the important part is the operational consequence: {detail}. Look for cleaner data, better decisions, or a new burden disguised as innovation."
    if section == "wellbeing":
        return f"The headline is only the doorway. The meaningful point is: {detail}. Keep the nuance, especially before treating research as personal medical guidance."
    if section == "entertainment":
        return f"This matters because culture and attention move money, behavior, and conversation. The actual development is: {detail}."
    if section == "animals":
        return f"The animal angle here is specific, not decorative: {detail}. It is worth watching for what it reveals about behavior, welfare, conservation, or our shared environment."
    if section == "wonderful":
        return f"Keep this one for the day: {detail}. It is concrete evidence that people still repair, help, rescue, and show up."
    return f"The useful part of this story is: {detail}."


def importance_score(item: dict[str, Any], now_ts: float) -> float:
    text = f"{item['headline']} {item['summary']}".lower()
    score = SOURCE_WEIGHT.get(item["source"], 2)
    score += 3 if item["section"] == "must-know" else 0
    score += 2 if item["section"] == "local" else 0
    score += 1 if item.get("image") else 0

    age_hours = max(0, (now_ts - item["timestamp"]) / 3600) if item["timestamp"] else 48
    score += max(0, 6 - age_hours / 6)

    for phrase, weight in IMPORTANT_WORDS.items():
        if phrase in text:
            score += weight
    return score


def collect_all() -> dict[str, list[dict[str, Any]]]:
    results: dict[str, list[dict[str, Any]]] = {section: [] for section in FEEDS}
    for original_section, feeds in FEEDS.items():
        for source_name, url in feeds:
            feed = feedparser.parse(url)
            for entry in feed.entries[:16]:
                link = (entry.get("link") or "").strip()
                headline = clean_text(entry.get("title"), 190)
                summary = clean_text(entry.get("summary") or entry.get("description"))
                if not link or not headline:
                    continue
                section = classify_section(original_section, headline, summary)
                item = {
                    "section": section,
                    "source": source_name,
                    "headline": headline,
                    "summary": summary,
                    "url": link,
                    "image": image_from_entry(entry),
                    "timestamp": entry_timestamp(entry),
                    "published": clean_text(entry.get("published") or entry.get("updated"), 80),
                }
                item["take"] = make_take(section, headline, summary)
                results.setdefault(section, []).append(item)

    for section in results:
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
    return {key: value for key, value in item.items() if key not in {"timestamp", "section", "score"}}


def main() -> None:
    now = datetime.now(timezone.utc)
    now_ts = now.timestamp()
    pools = collect_all()
    chosen_global: list[dict[str, Any]] = []
    sections: dict[str, list[dict[str, Any]]] = {}

    section_order = ["local", "must-know", "ai-tech", "work-marketing", "wellbeing", "entertainment", "animals", "wonderful"]

    top_pool = pools.get("must-know", []) + pools.get("local", []) + pools.get("ai-tech", [])
    for item in top_pool:
        item["score"] = importance_score(item, now_ts)
    top_pool.sort(key=lambda item: (item["score"], item["timestamp"]), reverse=True)
    top_story = top_pool[0] if top_pool else None
    if top_story:
        chosen_global.append(top_story)

    for section in section_order:
        candidates = [item for item in pools.get(section, []) if not top_story or item["url"] != top_story["url"]]
        selected = choose_diverse(candidates, ITEMS_PER_SECTION, chosen_global)
        chosen_global.extend(selected)
        sections[section] = [public_story(item) for item in selected]

    quick_scan_candidates: list[dict[str, Any]] = []
    for section in section_order:
        quick_scan_candidates.extend(pools.get(section, [])[:6])
    for item in quick_scan_candidates:
        item["score"] = importance_score(item, now_ts)
    quick_scan_candidates.sort(key=lambda item: (item["score"], item["timestamp"]), reverse=True)
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


CAPYBARA_MESSAGES = [
    "You do not have to solve the whole forest before breakfast. Find the next clear step and put one paw there.",
    "Urgency is often just anxiety wearing a tiny management badge. Breathe before you promote it.",
    "A steady morning is not wasted time. Roots are doing work even when nobody applauds them.",
    "Protect your attention. It is a garden, not a public parking lot.",
    "You are allowed to begin with the task that makes the rest of the day feel less haunted.",
]


if __name__ == "__main__":
    main()
