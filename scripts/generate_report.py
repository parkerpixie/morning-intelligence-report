from __future__ import annotations

import html
import json
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus
from zoneinfo import ZoneInfo

import feedparser

OUTPUT_PATH = Path("data/report.json")
HISTORY_PATH = Path("data/story-history.json")
REPORT_TZ = ZoneInfo("America/Chicago")
ITEMS_PER_SECTION = 4
MAX_PER_SOURCE = 2
HISTORY_HOURS = 72

SECTION_ORDER = [
    "local", "must-know", "ai-tech", "work-marketing",
    "wellbeing", "entertainment", "animals", "wonderful",
]

MAX_AGE_HOURS = {
    "local": 72,
    "must-know": 48,
    "ai-tech": 72,
    "work-marketing": 168,
    "wellbeing": 120,
    "entertainment": 168,
    "animals": 120,
    "wonderful": 168,
}


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
        ("Animals", google_news("animals pets wildlife rescue conservation when:3d")),
    ],
    "wonderful": [
        ("Good News Network", "https://www.goodnewsnetwork.org/feed/"),
        ("Positive News", "https://www.positive.news/feed/"),
        ("Wonderful News", google_news("uplifting inspiring community kindness rescue when:3d")),
    ],
}

ANIMAL_TERMS = {
    "animal", "animals", "dog", "dogs", "puppy", "puppies", "cat", "cats", "kitten", "kittens",
    "pet", "pets", "wildlife", "bird", "birds", "bear", "bears", "wolf", "wolves", "whale", "whales",
    "dolphin", "dolphins", "elephant", "elephants", "horse", "horses", "rabbit", "rabbits", "fox",
    "foxes", "otter", "otters", "capybara", "zoo", "species", "habitat", "conservation", "rescue",
    "shelter", "veterinary", "veterinarian", "marine life", "insect", "insects", "bee", "bees",
    "butterfly", "butterflies", "turtle", "turtles", "shark", "sharks", "penguin", "penguins",
    "primate", "primates", "monkey", "monkeys", "gorilla", "gorillas", "lion", "lions", "tiger",
    "tigers", "deer", "moose", "bison", "seal", "seals", "octopus", "fish", "frog", "frogs",
}

ANIMAL_REJECT_PHRASES = {
    "market analysis", "market size", "forecast, size, trends", "how to watch", "championship",
    "major tournament", "golf", "basketball", "football", "baseball", "tennis", "headphones",
    "earbuds", "stock price", "shares rise", "shopping guide",
}

IMPORTANT_WORDS = {
    "election": 6, "president": 6, "congress": 5, "supreme court": 6, "war": 6,
    "ceasefire": 6, "economy": 5, "inflation": 5, "jobs": 4, "interest rates": 5,
    "federal reserve": 5, "breaking": 5, "emergency": 6, "wildfire": 5, "flood": 5,
    "hurricane": 5, "tornado": 5, "law": 4, "policy": 4, "rights": 5, "abortion": 5,
    "lgbtq": 5, "education": 4, "openai": 4, "anthropic": 4,
    "artificial intelligence": 4, "cybersecurity": 4, "data breach": 5,
    "wisconsin": 3, "madison": 4, "dane county": 4, "uw-madison": 4, "taylor swift": 5,
}

SOURCE_WEIGHT = {
    "Reuters": 7, "Associated Press": 7, "NPR": 6, "BBC World": 6,
    "BBC US & Canada": 6, "Wisconsin Public Radio": 6,
    "MIT Technology Review": 5, "The Verge": 4, "Ars Technica": 4, "Variety": 4,
}

CAPYBARA_MESSAGES = [
    "You do not have to solve the whole forest before breakfast. Find the next clear step and put one paw there.",
    "Urgency is often just anxiety wearing a tiny management badge. Breathe before you promote it.",
    "A steady morning is not wasted time. Roots are doing work even when nobody applauds them.",
    "Protect your attention. It is a garden, not a public parking lot.",
    "Begin with the task that makes the rest of the day feel less haunted.",
    "Some problems are not yours to carry. Put the backpack down and see who finally notices it has handles.",
    "Today does not need a heroic version of you. It needs an honest one with water nearby.",
    "Do not confuse being needed with being supported. Those are very different ecosystems.",
    "The loudest request is not automatically the most important one. Volume is not governance.",
    "Your nervous system is not a customer-service desk. It may close the window without explanation.",
    "Do one thing before opening the gates to everyone else’s priorities.",
    "A boundary does not require a closing argument. No is already a complete fence.",
    "You may disappoint someone and still be behaving responsibly. Clementine checked the bylaws.",
    "Stop trying to earn rest from a committee that keeps moving the requirements.",
    "Your attention is expensive. Quit handing out free samples to every blinking notification.",
    "Not every wobble is a collapse. Sometimes the bridge is simply reminding you that it can move.",
    "You are allowed to choose the boring solution that actually works.",
    "A plan can be kind and still contain teeth.",
    "Before fixing the whole system, ask whether one small lever would move the day.",
    "You cannot regulate an entire household by becoming more exhausted than everyone in it.",
    "Perfection is often procrastination in a blazer. Send the useful version.",
    "Today’s assignment: notice the moment you start doing someone else’s thinking for them.",
    "You are not behind. You are carrying too many clocks, several of which belong to other people.",
    "Let the awkward silence sit there. It arrived without luggage and can leave the same way.",
    "The day may be crowded. That does not mean every demand gets a chair.",
    "Choose one thing to protect before the world starts negotiating with you.",
    "Your brain is offering twelve tabs and a small fire. Pick one tab. The fire may be decorative.",
    "Competence is not consent to become the emergency contact for everything.",
    "The next right step may be unimpressive. Take it anyway. Glitter is optional.",
    "You do not need to make the truth more comfortable before saying it.",
    "A pause is not a failure of momentum. It is where steering happens.",
    "Someone else’s confusion is not always your assignment to resolve.",
    "Today, trade one ounce of overexplaining for one ounce of self-trust.",
    "There is no prize for answering every question before anyone else has tried thinking.",
    "If the plan depends on you never getting tired, the plan is garbage.",
    "Be suspicious of tasks that arrive wearing urgency but carrying no consequences.",
    "You may care deeply without taking over completely.",
    "Your worth is not a productivity dashboard, and frankly the dashboard has terrible data hygiene.",
    "Do not spend premium morning brain on bargain-bin nonsense.",
    "The people who benefit from your lack of boundaries may file complaints. Let them enjoy the paperwork.",
    "You are allowed to make today smaller until it fits inside your actual life.",
    "When everything feels important, choose what will still matter after lunch.",
    "No one gets your best thinking by scattering it across seventeen tiny emergencies.",
    "Courage is sometimes sending the email. Sometimes it is refusing to write the fifth version.",
    "You can be compassionate without becoming absorbent.",
    "Today’s challenge: leave one solvable problem with the person who owns it.",
    "A clear answer may feel rude only because chaos has been receiving concierge service.",
    "Do not negotiate against yourself before anyone else has even entered the room.",
    "Your pace is allowed to be human, even when the machinery is being dramatic.",
    "If you keep rescuing the process, the process never learns to stop walking into traffic.",
    "You do not need a better attitude about an unreasonable load. You need less load.",
    "Pick the task that creates relief, not merely the task making the most noise.",
    "You are not required to turn every difficult feeling into an immediate action item.",
    "A good morning can begin with deciding what will not be allowed to eat it.",
    "The universe has received your request to control every variable. It has declined with no further comment.",
    "Be kind to yourself, but not vague. Name the thing. Choose the step. Close a tab.",
    "Today may ask for flexibility. It does not get unlimited access to your spine.",
    "Keep one promise to yourself before becoming useful to everyone else.",
    "Your calm is not evidence that the problem belongs to you.",
    "Sometimes the profound move is making coffee and refusing to catastrophize before the first sip.",
]


def clean_text(value: str | None, limit: int = 430) -> str:
    if not value:
        return "Open the original source for the full details."
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value).strip()
    value = re.split(r"\bThe post\b", value, maxsplit=1, flags=re.IGNORECASE)[0].strip()
    value = re.sub(r"\s*\[(?:…|\.\.\.)\]\s*$", "", value).strip()
    if not value:
        return "Open the original source for the full details."
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
    stop = {
        "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with",
        "as", "is", "are", "from", "at", "by", "after", "new", "says",
    }
    return {
        word for word in re.findall(r"[a-z0-9]+", title.lower())
        if len(word) > 2 and word not in stop
    }


def headline_similarity(first: str, second: str) -> float:
    first_tokens = title_tokens(first)
    second_tokens = title_tokens(second)
    union = first_tokens | second_tokens
    return len(first_tokens & second_tokens) / len(union) if union else 0


def is_duplicate(candidate: dict[str, Any], chosen: list[dict[str, Any]]) -> bool:
    return any(
        candidate["url"] == item.get("url")
        or headline_similarity(candidate["headline"], item.get("headline", "")) >= 0.48
        for item in chosen
    )


def contains_term(text: str, term: str) -> bool:
    return re.search(
        rf"(?<![a-z0-9]){re.escape(term.lower())}(?![a-z0-9])",
        text.lower(),
    ) is not None


def has_any_term(text: str, terms: set[str] | tuple[str, ...]) -> bool:
    return any(contains_term(text, term) for term in terms)


def looks_like_animal_story(headline: str, summary: str) -> bool:
    text = f"{headline} {summary}".lower()
    headline_hits = sum(contains_term(headline, term) for term in ANIMAL_TERMS)
    total_hits = sum(contains_term(text, term) for term in ANIMAL_TERMS)
    rejected = any(phrase in text for phrase in ANIMAL_REJECT_PHRASES)
    return (headline_hits >= 1 and (not rejected or total_hits >= 2)) or (
        total_hits >= 2 and not rejected
    )


def classify_section(original: str, headline: str, summary: str) -> str:
    text = f"{headline} {summary}".lower()

    if original == "wonderful":
        return "wonderful"
    if has_any_term(text, ("madison", "dane county", "wisconsin", "uw-madison", "milwaukee")):
        return "local"
    if "taylor swift" in text or has_any_term(
        text,
        ("album", "concert", "film", "movie", "television", "actor", "actress", "singer", "music", "netflix", "streaming"),
    ):
        return "entertainment"
    if has_any_term(
        text,
        ("openai", "anthropic", "artificial intelligence", "ai", "technology", "cybersecurity", "software", "robot", "chip", "privacy"),
    ):
        return "ai-tech"
    if has_any_term(
        text,
        ("marketing", "salesforce", "hubspot", "crm", "customer experience", "automation", "analytics", "advertising", "brand"),
    ):
        return "work-marketing"
    if has_any_term(
        text,
        ("mental health", "psychology", "adhd", "autism", "therapy", "depression", "anxiety", "health", "medical", "hospital", "disease", "drug", "treatment"),
    ):
        return "wellbeing"
    if looks_like_animal_story(headline, summary):
        return "animals"
    return "__reject__" if original == "animals" else original


def first_sentence(text: str, limit: int = 180) -> str:
    sentence = re.split(r"(?<=[.!?])\s+", text.strip())[0].rstrip(".")
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
        if has_any_term(text, ("election", "congress", "court", "law", "policy", "president")):
            return f"The consequential part is not the political theater. It is what this could change in law, policy, rights, or public life: {detail}."
        if has_any_term(text, ("economy", "inflation", "jobs", "rates", "market")):
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
    score += sum(weight for phrase, weight in IMPORTANT_WORDS.items() if phrase in text)
    return score


def is_fresh_enough(item: dict[str, Any], now_ts: float) -> bool:
    if not item["timestamp"]:
        return True
    age_hours = max(0, (now_ts - item["timestamp"]) / 3600)
    return age_hours <= MAX_AGE_HOURS.get(item["section"], 96)


def collect_all(now_ts: float) -> dict[str, list[dict[str, Any]]]:
    results: dict[str, list[dict[str, Any]]] = {section: [] for section in FEEDS}
    for original_section, feeds in FEEDS.items():
        for source_name, url in feeds:
            feed = feedparser.parse(url)
            for entry in feed.entries[:18]:
                link = (entry.get("link") or "").strip()
                headline = clean_text(entry.get("title"), 190)
                summary = clean_text(entry.get("summary") or entry.get("description"))
                if not link or not headline:
                    continue
                section = classify_section(original_section, headline, summary)
                if section == "__reject__":
                    continue
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
                if not is_fresh_enough(item, now_ts):
                    continue
                item["take"] = make_take(section, headline, summary)
                results.setdefault(section, []).append(item)

    for section in results:
        results[section].sort(key=lambda item: item["timestamp"], reverse=True)
    return results


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(REPORT_TZ)


def report_stories(report: dict[str, Any]) -> list[dict[str, str]]:
    stories: list[dict[str, str]] = []
    if isinstance(report.get("top_story"), dict):
        stories.append(report["top_story"])
    for section_stories in (report.get("sections") or {}).values():
        if isinstance(section_stories, list):
            stories.extend(story for story in section_stories if isinstance(story, dict))
    return stories


def history_from_previous_report() -> list[dict[str, str]]:
    if not OUTPUT_PATH.exists():
        return []
    try:
        report = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    generated = parse_datetime(report.get("generated_at"))
    if not generated:
        return []
    return [
        {
            "url": story.get("url", ""),
            "headline": story.get("headline", ""),
            "seen_at": generated.isoformat(),
            "seen_date": generated.date().isoformat(),
        }
        for story in report_stories(report)
        if story.get("url") and story.get("headline")
    ]


def load_history(now: datetime) -> list[dict[str, str]]:
    history: list[dict[str, str]] = []
    if HISTORY_PATH.exists():
        try:
            saved = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
            if isinstance(saved, list):
                history.extend(item for item in saved if isinstance(item, dict))
        except (json.JSONDecodeError, OSError):
            pass
    history.extend(history_from_previous_report())

    cutoff = now - timedelta(hours=HISTORY_HOURS)
    cleaned: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in history:
        seen_at = parse_datetime(item.get("seen_at"))
        key = (item.get("url", ""), item.get("headline", ""))
        if not seen_at or seen_at < cutoff or not all(key) or key in seen:
            continue
        cleaned.append(item)
        seen.add(key)
    return cleaned


def appeared_before(item: dict[str, Any], history: list[dict[str, str]], today: str) -> bool:
    for prior in history:
        if prior.get("seen_date") == today:
            continue
        if item["url"] == prior.get("url"):
            return True
        if headline_similarity(item["headline"], prior.get("headline", "")) >= 0.56:
            return True
    return False


def choose_diverse(
    candidates: list[dict[str, Any]],
    limit: int,
    global_chosen: list[dict[str, Any]],
    history: list[dict[str, str]],
    today: str,
) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    source_counts: Counter[str] = Counter()
    for item in candidates:
        if source_counts[item["source"]] >= MAX_PER_SOURCE:
            continue
        if appeared_before(item, history, today):
            continue
        if is_duplicate(item, global_chosen + selected):
            continue
        selected.append(item)
        source_counts[item["source"]] += 1
        if len(selected) >= limit:
            break
    return selected


def public_story(item: dict[str, Any] | None) -> dict[str, Any] | None:
    if not item:
        return None
    return {
        key: value
        for key, value in item.items()
        if key not in {"timestamp", "section", "score"}
    }


def write_history(
    history: list[dict[str, str]],
    report: dict[str, Any],
    now: datetime,
) -> None:
    added = [
        {
            "url": story.get("url", ""),
            "headline": story.get("headline", ""),
            "seen_at": now.isoformat(),
            "seen_date": now.date().isoformat(),
        }
        for story in report_stories(report)
        if story.get("url") and story.get("headline")
    ]
    combined = history + added
    unique: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in reversed(combined):
        key = (item.get("url", ""), item.get("headline", ""))
        if not all(key) or key in seen:
            continue
        unique.append(item)
        seen.add(key)
    HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    HISTORY_PATH.write_text(
        json.dumps(list(reversed(unique)), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def choose_clementine(now: datetime) -> str:
    return CAPYBARA_MESSAGES[now.toordinal() % len(CAPYBARA_MESSAGES)]


def main() -> None:
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(REPORT_TZ)
    now_ts = now_utc.timestamp()
    today = now_local.date().isoformat()
    history = load_history(now_local)
    pools = collect_all(now_ts)

    chosen_global: list[dict[str, Any]] = []
    sections: dict[str, list[dict[str, Any]]] = {}

    top_pool = pools.get("must-know", []) + pools.get("local", []) + pools.get("ai-tech", [])
    for item in top_pool:
        item["score"] = importance_score(item, now_ts)
    top_pool.sort(key=lambda item: (item["score"], item["timestamp"]), reverse=True)
    fresh_top = [
        item for item in top_pool
        if not appeared_before(item, history, today)
    ]
    top_story = fresh_top[0] if fresh_top else (top_pool[0] if top_pool else None)
    if top_story:
        chosen_global.append(top_story)

    for section in SECTION_ORDER:
        candidates = [
            item for item in pools.get(section, [])
            if not top_story or item["url"] != top_story["url"]
        ]
        selected = choose_diverse(
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
    for section in SECTION_ORDER:
        quick_candidates.extend(pools.get(section, [])[:8])
    for item in quick_candidates:
        item["score"] = importance_score(item, now_ts)
    quick_candidates.sort(
        key=lambda item: (item["score"], item["timestamp"]),
        reverse=True,
    )
    quick_scan = choose_diverse(
        quick_candidates,
        9,
        chosen_global,
        history,
        today,
    )

    report = {
        "generated_at": now_utc.isoformat(),
        "generated_at_local": now_local.isoformat(),
        "report_date": today,
        "top_story": public_story(top_story),
        "quick_scan": [
            public_story(item) for item in quick_scan if public_story(item)
        ],
        "sections": sections,
        "wonderful": sections["wonderful"][0] if sections["wonderful"] else None,
        "capybara_message": choose_clementine(now_local),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    write_history(history, report, now_local)
    print(
        f"Wrote {OUTPUT_PATH} for {today} with "
        f"{sum(len(items) for items in sections.values())} section stories"
    )


if __name__ == "__main__":
    main()
