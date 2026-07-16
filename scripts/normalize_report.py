from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPORT_PATH = Path("data/report.json")
LEAD_FALLBACK_IMAGE = "assets/images/clementine-madison-morning.webp"
SECTION_PRIORITY = [
    "must-know",
    "local",
    "ai-tech",
    "work-marketing",
    "wellbeing",
    "entertainment",
    "animals",
    "wonderful",
]


def clean_story(story: Any) -> Any:
    if not isinstance(story, dict):
        return story
    cleaned = dict(story)
    cleaned.pop("take", None)
    return cleaned


def image_story_candidates(report: dict[str, Any]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []

    top_story = report.get("top_story")
    if isinstance(top_story, dict):
        candidates.append(top_story)

    sections = report.get("sections") or {}
    if isinstance(sections, dict):
        for section_name in SECTION_PRIORITY:
            stories = sections.get(section_name) or []
            if isinstance(stories, list):
                candidates.extend(story for story in stories if isinstance(story, dict))

    quick_scan = report.get("quick_scan") or []
    if isinstance(quick_scan, list):
        candidates.extend(story for story in quick_scan if isinstance(story, dict))

    return candidates


def normalize(report: dict[str, Any]) -> dict[str, Any]:
    top_story = clean_story(report.get("top_story"))

    if isinstance(top_story, dict) and not top_story.get("image"):
        replacement = next(
            (story for story in image_story_candidates(report) if story.get("image")),
            None,
        )
        if replacement:
            top_story = clean_story(replacement)
        else:
            top_story["image"] = LEAD_FALLBACK_IMAGE

    report["top_story"] = top_story

    quick_scan = report.get("quick_scan") or []
    report["quick_scan"] = [clean_story(story) for story in quick_scan]

    sections = report.get("sections") or {}
    report["sections"] = {
        section_name: [clean_story(story) for story in stories]
        for section_name, stories in sections.items()
        if isinstance(stories, list)
    }

    wonderful = report["sections"].get("wonderful", [])
    report["wonderful"] = wonderful[0] if wonderful else None

    return report


def main() -> None:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    normalized = normalize(report)
    REPORT_PATH.write_text(
        json.dumps(normalized, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print("Normalized report: removed take fields and guaranteed a lead image.")


if __name__ == "__main__":
    main()
