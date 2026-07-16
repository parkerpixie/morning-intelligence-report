from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

REPORT_PATH = Path("data/report.json")
ARCHIVE_DIR = Path("data/archive")
INDEX_PATH = Path("data/report-index.json")
SEARCH_INDEX_PATH = Path("data/archive-search.json")

REQUIRED_SECTIONS = (
    "local",
    "must-know",
    "ai-tech",
    "work-marketing",
    "wellbeing",
    "entertainment",
    "animals",
    "wonderful",
)
REQUIRED_STORY_FIELDS = ("source", "headline", "summary", "url")
TRACKING_QUERY_KEYS = {
    "at_campaign",
    "at_medium",
    "at_ptr_name",
    "at_format",
    "at_link_id",
    "oc",
    "utm_campaign",
    "utm_content",
    "utm_medium",
    "utm_source",
    "utm_term",
}


class ReportValidationError(ValueError):
    """Raised when a generated report is incomplete or malformed."""


def is_nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_story(story: Any, label: str, errors: list[str]) -> None:
    if not isinstance(story, dict):
        errors.append(f"{label} must be an object")
        return

    for field in REQUIRED_STORY_FIELDS:
        if not is_nonempty_string(story.get(field)):
            errors.append(f"{label}.{field} must be a non-empty string")

    url = story.get("url")
    if is_nonempty_string(url) and not url.startswith(("https://", "http://")):
        errors.append(f"{label}.url must begin with http:// or https://")


def parse_iso_datetime(value: Any, label: str, errors: list[str]) -> None:
    if not is_nonempty_string(value):
        errors.append(f"{label} must be a non-empty ISO timestamp")
        return
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        errors.append(f"{label} must be a valid ISO timestamp")


def validate_report(report: Any) -> dict[str, Any]:
    errors: list[str] = []

    if not isinstance(report, dict):
        raise ReportValidationError("Report root must be a JSON object")

    parse_iso_datetime(report.get("generated_at"), "generated_at", errors)

    report_date = report.get("report_date")
    if not is_nonempty_string(report_date):
        errors.append("report_date must be a non-empty ISO date")
    else:
        try:
            date.fromisoformat(report_date)
        except ValueError:
            errors.append("report_date must be a valid ISO date")

    validate_story(report.get("top_story"), "top_story", errors)

    quick_scan = report.get("quick_scan")
    if not isinstance(quick_scan, list):
        errors.append("quick_scan must be an array")
    elif not quick_scan:
        errors.append("quick_scan must contain at least one story")
    else:
        for index, story in enumerate(quick_scan):
            validate_story(story, f"quick_scan[{index}]", errors)

    sections = report.get("sections")
    if not isinstance(sections, dict):
        errors.append("sections must be an object")
    else:
        for section_name in REQUIRED_SECTIONS:
            stories = sections.get(section_name)
            if not isinstance(stories, list):
                errors.append(f"sections.{section_name} must be an array")
                continue
            for index, story in enumerate(stories):
                validate_story(story, f"sections.{section_name}[{index}]", errors)

    if not is_nonempty_string(report.get("capybara_message")):
        errors.append("capybara_message must be a non-empty string")

    if errors:
        details = "\n - ".join(errors)
        raise ReportValidationError(f"Generated report failed validation:\n - {details}")

    return report


def write_json_atomic(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(path)


def canonical_url(value: str) -> str:
    try:
        parts = urlsplit(value.strip())
        query = [
            (key, item)
            for key, item in parse_qsl(parts.query, keep_blank_values=True)
            if key.lower() not in TRACKING_QUERY_KEYS
        ]
        return urlunsplit(
            (
                parts.scheme.lower(),
                parts.netloc.lower(),
                parts.path.rstrip("/") or "/",
                urlencode(query, doseq=True),
                "",
            )
        )
    except ValueError:
        return value.strip()


def story_id(story: dict[str, Any]) -> str:
    identity = canonical_url(story["url"]) or story["headline"].strip().lower()
    return hashlib.sha1(identity.encode("utf-8")).hexdigest()[:16]


def iter_report_stories(report: dict[str, Any]):
    yield "big-story", report["top_story"]
    for story in report.get("quick_scan", []):
        yield "quick-scan", story
    for section_name in REQUIRED_SECTIONS:
        for story in report.get("sections", {}).get(section_name, []):
            yield section_name, story


def edition_metadata(path: Path, report: dict[str, Any]) -> dict[str, Any]:
    unique_ids = {story_id(story) for _, story in iter_report_stories(report)}
    section_counts = {
        section_name: len(report.get("sections", {}).get(section_name, []))
        for section_name in REQUIRED_SECTIONS
    }
    return {
        "report_date": report["report_date"],
        "generated_at": report["generated_at"],
        "path": path.as_posix(),
        "top_story": {
            "source": report["top_story"]["source"],
            "headline": report["top_story"]["headline"],
            "summary": report["top_story"]["summary"],
            "url": report["top_story"]["url"],
            "image": report["top_story"].get("image", ""),
        },
        "story_count": len(unique_ids),
        "section_counts": section_counts,
    }


def load_archived_reports() -> list[tuple[Path, dict[str, Any]]]:
    archived: list[tuple[Path, dict[str, Any]]] = []
    for path in sorted(ARCHIVE_DIR.glob("*.json"), reverse=True):
        try:
            report = json.loads(path.read_text(encoding="utf-8"))
            validated = validate_report(report)
        except (OSError, json.JSONDecodeError, ReportValidationError) as error:
            raise ReportValidationError(f"Archived report {path} is invalid: {error}") from error
        archived.append((path, validated))
    return archived


def build_search_index(
    archived_reports: list[tuple[Path, dict[str, Any]]],
) -> dict[str, Any]:
    stories: dict[str, dict[str, Any]] = {}

    for _, report in archived_reports:
        report_date = report["report_date"]
        for section_name, story in iter_report_stories(report):
            identifier = story_id(story)
            existing = stories.get(identifier)

            if existing is None:
                existing = {
                    "id": identifier,
                    "source": story["source"],
                    "headline": story["headline"],
                    "summary": story["summary"],
                    "url": story["url"],
                    "canonical_url": canonical_url(story["url"]),
                    "image": story.get("image", ""),
                    "published": story.get("published", ""),
                    "sections": [],
                    "report_dates": [],
                    "first_seen": report_date,
                    "last_seen": report_date,
                    "appearances": 0,
                }
                stories[identifier] = existing
            else:
                if not existing.get("image") and story.get("image"):
                    existing["image"] = story["image"]
                if len(story.get("summary", "")) > len(existing.get("summary", "")):
                    existing["summary"] = story["summary"]
                if story.get("published") and not existing.get("published"):
                    existing["published"] = story["published"]

            if section_name not in existing["sections"]:
                existing["sections"].append(section_name)
            if report_date not in existing["report_dates"]:
                existing["report_dates"].append(report_date)

            existing["first_seen"] = min(existing["first_seen"], report_date)
            existing["last_seen"] = max(existing["last_seen"], report_date)
            existing["appearances"] = len(existing["report_dates"])

    ordered_stories = sorted(
        stories.values(),
        key=lambda item: (item["last_seen"], item["headline"].lower()),
        reverse=True,
    )
    for story in ordered_stories:
        story["sections"].sort()
        story["report_dates"].sort(reverse=True)

    return {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "edition_count": len(archived_reports),
        "story_count": len(ordered_stories),
        "stories": ordered_stories,
    }


def archive_report(report: dict[str, Any]) -> Path:
    report_date = report["report_date"]
    archive_path = ARCHIVE_DIR / f"{report_date}.json"
    write_json_atomic(archive_path, report)

    archived_reports = load_archived_reports()
    editions = [edition_metadata(path, archived) for path, archived in archived_reports]
    latest = editions[0]

    index_payload = {
        "latest": latest["path"],
        "report_date": latest["report_date"],
        "generated_at": latest["generated_at"],
        "edition_count": len(editions),
        "editions": editions,
    }
    write_json_atomic(INDEX_PATH, index_payload)
    write_json_atomic(SEARCH_INDEX_PATH, build_search_index(archived_reports))
    return archive_path


def main() -> None:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    validated = validate_report(report)
    archive_path = archive_report(validated)
    print(
        f"Validated {REPORT_PATH}, archived it to {archive_path}, "
        f"and rebuilt the archive catalog and search index."
    )


if __name__ == "__main__":
    main()
