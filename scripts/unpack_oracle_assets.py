from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "oracle"
ARCHIVE = ASSET_DIR / "card-assets.zip"
PARTS = tuple(sorted(ASSET_DIR.glob("card-assets.zip.part-*")))
TARGET = ASSET_DIR
ALLOWED_ROOTS = {"oracle", "reflections"}
ALLOWED_FILES = {"oracle-manifest.json"}


def safe_destination(member_name: str) -> Path:
    member = Path(member_name)
    if member.is_absolute() or ".." in member.parts:
        raise ValueError(f"Unsafe oracle asset path: {member_name}")
    if not member.parts or (member.parts[0] not in ALLOWED_ROOTS and member.as_posix() not in ALLOWED_FILES):
        raise ValueError(f"Unexpected oracle asset path: {member_name}")
    destination = (TARGET / member).resolve()
    if TARGET.resolve() not in destination.parents and destination != TARGET.resolve():
        raise ValueError(f"Oracle asset escaped target directory: {member_name}")
    return destination


def assembled_archive() -> tuple[Path, bool]:
    if ARCHIVE.exists():
        return ARCHIVE, False
    if not PARTS:
        raise FileNotFoundError(f"Oracle asset archive or parts not found in {ASSET_DIR}")

    temporary = NamedTemporaryFile(prefix="oracle-card-assets-", suffix=".zip", delete=False)
    temporary_path = Path(temporary.name)
    try:
        with temporary:
            for part in PARTS:
                temporary.write(part.read_bytes())
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise
    return temporary_path, True


def main() -> None:
    archive_path, remove_after = assembled_archive()
    try:
        extracted = 0
        with ZipFile(archive_path) as bundle:
            for info in bundle.infolist():
                if info.is_dir():
                    continue
                destination = safe_destination(info.filename)
                destination.parent.mkdir(parents=True, exist_ok=True)
                with bundle.open(info) as source, destination.open("wb") as target:
                    target.write(source.read())
                extracted += 1
        print(f"Extracted {extracted} oracle assets into {TARGET}.")
    finally:
        if remove_after:
            archive_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
