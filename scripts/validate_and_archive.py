from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

REPORT_PATH = Path("data/report.json")
ARCHIVE_DIR = Path("data/archive")
INDEX_PATH = Path("data/report-index.json")

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


def archive_report(report: dict[str, Any]) -> Path:
    report_date = report["report_date"]
    archive_path = ARCHIVE_DIR / f"{report_date}.json"
    write_json_atomic(archive_path, report)

    index_payload = {
        "latest": archive_path.as_posix(),
        "report_date": report_date,
        "generated_at": report["generated_at"],
    }
    write_json_atomic(INDEX_PATH, index_payload)
    return archive_path


def main() -> None:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    validated = validate_report(report)
    archive_path = archive_report(validated)
    print(f"Validated {REPORT_PATH} and archived it to {archive_path}.")


if __name__ == "__main__":
    main()
