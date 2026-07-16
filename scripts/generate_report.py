from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import feedparser

OUTPUT_PATH = Path("data/report.json")
ITEMS_PER_SECTION = 2

FEEDS: dict[str, list[tuple[str, str]]] = {
    "politics": [
        ("BBC US & Canada", "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"),
        ("NPR News", "https://feeds.npr.org/1001/rss.xml"),
    ],
    "equal-rights": [
        ("ACLU", "https://www.aclu.org/news/feed"),
        ("NPR News", "https://feeds.npr.org/1001/rss.xml"),
    ],
    "science": [
        ("BBC Science", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"),
        ("NASA", "https://www.nasa.gov/feed/"),
    ],
    "technology": [
        ("BBC Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml"),
        ("MIT Technology Review", "https://www.technologyreview.com/feed/"),
    ],
    "marketing": [
        ("HubSpot Marketing", "https://blog.hubspot.com/marketing/rss.xml"),
        ("MarTech", "https://martech.org/feed/"),
    ],
    "celebrity": [
        ("BBC Entertainment", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"),
        ("Variety", "https://variety.com/feed/"),
    ],
    "music": [
        ("Pitchfork News", "https://pitchfork.com/rss/news/"),
        ("NPR Music", "https://feeds.npr.org/1039/rss.xml"),
    ],
    "health": [
        ("BBC Health", "https://feeds.bbci.co.uk/news/health/rss.xml"),
        ("NPR News", "https://feeds.npr.org/1001/rss.xml"),
    ],
    "mental-health": [
        ("ScienceDaily Mind & Brain", "https://www.sciencedaily.com/rss/mind_brain.xml"),
        ("Medical News Today", "https://www.medicalnewstoday.com/rss/mental_health.xml"),
    ],
    "animals": [
        ("Smithsonian Smart News", "https://www.smithsonianmag.com/rss/smart-news/"),
        ("BBC Science", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"),
    ],
    "uplifting": [
        ("Good News Network", "https://www.goodnewsnetwork.org/feed/"),
        ("Positive News", "https://www.positive.news/feed/"),
    ],
}

CATEGORY_CONTEXT = {
    "politics": "This could affect public policy, institutions, elections, or the everyday rules people live under.",
    "equal-rights": "Rights are practical, not decorative. This story may affect access, safety, freedom, or accountability.",
    "science": "This adds evidence to how we understand the world and may shape future research or decisions.",
    "technology": "Technology quietly changes work, privacy, access, and power long before the dust settles.",
    "marketing": "This may influence how teams use data, automation, customer experience, or measurement.",
    "celebrity": "Culture stories reveal what audiences are paying attention to, even when the spectacle arrives wearing sequins.",
    "music": "Music news often signals broader shifts in culture, business, touring, and creative work.",
    "health": "Health reporting can shape care decisions, public understanding, and access to reliable information.",
    "mental-health": "Mental-health information deserves context because oversimplified claims can travel faster than careful evidence.",
    "animals": "Animal stories can illuminate conservation, behavior, welfare, and the ecosystems we share.",
    "uplifting": "This is evidence that people still build, help, rescue, repair, and show up for one another.",
}

PARKER_READ = {
    "politics": "Watch what changes materially, not just which person wins the microphone for the afternoon.",
    "equal-rights": "The useful question is who gains protection, who loses it, and what happens next in real life.",
    "science": "Promising is not the same as proven, but curiosity gets to keep its little lantern lit.",
    "technology": "Useful beats flashy. The real test is whether this improves life or merely adds another dashboard.",
    "marketing": "Look for the operational consequence: cleaner data, better decisions, or a shinier version of the same old funnel.",
    "celebrity": "Worth knowing, perhaps. Worth reorganizing your nervous system around, absolutely not.",
    "music": "The industry angle matters, but so does the simple question: does it make you feel more alive?",
    "health": "Treat the headline as an invitation to read carefully, not as personalized medical advice.",
    "mental-health": "Human behavior is rarely a one-variable spreadsheet. Keep the nuance and discard the miracle claims.",
    "animals": "Creatures remain undefeated at making science more interesting and humans slightly less self-important.",
    "uplifting": "Keep this one. The internet has extracted enough rent from your attention today.",
}

TOOLS = [
    {
        "name": "Make",
        "summary": "A visual automation platform for connecting apps, routing data, and building multi-step workflows.",
        "best_for": "Cross-platform workflows with branching logic and visible data mapping",
        "verdict": "Powerful once the scenario stops looking like an electrical diagram designed by an octopus.",
        "url": "https://www.make.com/",
    },
    {
        "name": "n8n",
        "summary": "A flexible workflow automation tool with strong control over data, APIs, and self-hosting.",
        "best_for": "Technical automations that need more control than a lightweight connector tool",
        "verdict": "Excellent for systems thinkers who enjoy seeing the gears instead of being told the machine is magical.",
        "url": "https://n8n.io/",
    },
    {
        "name": "Zapier",
        "summary": "A broad automation platform that makes common app-to-app workflows quick to launch.",
        "best_for": "Straightforward business automations and rapid prototypes",
        "verdict": "Fast and friendly, though complex workflows can develop a surprisingly expensive appetite.",
        "url": "https://zapier.com/",
    },
]

CAPYBARA_MESSAGES = [
    "You do not have to solve the whole forest before breakfast. Find the next clear step and put one paw there.",
    "Urgency is often just anxiety wearing a tiny management badge. Breathe before you promote it.",
    "A steady morning is not wasted time. Roots are doing work even when nobody applauds them.",
    "Protect your attention. It is a garden, not a public parking lot.",
    "You are allowed to begin with the task that makes the rest of the day feel less haunted.",
]


def clean_text(value: str | None, limit: int = 520) -> str:
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


def collect_category(category: str) -> list[dict[str, str]]:
    collected: list[dict[str, Any]] = []
    seen_links: set[str] = set()

    for source_name, url in FEEDS[category]:
        feed = feedparser.parse(url)
        for entry in feed.entries[:10]:
            link = entry.get("link", "").strip()
            title = clean_text(entry.get("title"), 180)
            if not link or link in seen_links or not title:
                continue
            seen_links.add(link)
            collected.append(
                {
                    "category": source_name,
                    "headline": title,
                    "summary": clean_text(entry.get("summary") or entry.get("description")),
                    "why_it_matters": CATEGORY_CONTEXT[category],
                    "parker_read": PARKER_READ[category],
                    "url": link,
                    "timestamp": entry_timestamp(entry),
                }
            )

    collected.sort(key=lambda item: item["timestamp"], reverse=True)
    return [
        {key: value for key, value in item.items() if key != "timestamp"}
        for item in collected[:ITEMS_PER_SECTION]
    ]


def fallback_story(category: str) -> dict[str, str]:
    return {
        "category": "Feed check",
        "headline": "This section is waiting for its next fresh RSS item.",
        "summary": "One or more sources did not return a usable story during this run. The next refresh will try again.",
        "why_it_matters": CATEGORY_CONTEXT[category],
        "parker_read": "A quiet feed is not a catastrophe. It is merely the internet declining to perform on command for once.",
        "url": "",
    }


def main() -> None:
    now = datetime.now(timezone.utc)
    sections: dict[str, list[dict[str, str]]] = {}

    for category in FEEDS:
        stories = collect_category(category)
        sections[category] = stories or [fallback_story(category)]

    top_candidates = sections["politics"] + sections["science"] + sections["technology"]
    top_story = top_candidates[0] if top_candidates else fallback_story("politics")
    uplifting = sections["uplifting"][0]
    tool = TOOLS[now.toordinal() % len(TOOLS)]
    capybara_message = CAPYBARA_MESSAGES[now.toordinal() % len(CAPYBARA_MESSAGES)]

    report = {
        "generated_at": now.isoformat(),
        "report_date": now.strftime("%Y-%m-%d"),
        "top_story": top_story,
        "sections": sections,
        "tool": tool,
        "uplifting": uplifting,
        "capybara_message": capybara_message,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {sum(len(items) for items in sections.values())} stories")


if __name__ == "__main__":
    main()
