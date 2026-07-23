from __future__ import annotations

import generate_report as base
import generate_report_v2 as personalized


def add_feed(section: str, source: str, query: str) -> None:
    """Add a focused Google News RSS source without duplicating an existing label."""
    if any(existing_source == source for existing_source, _ in base.FEEDS[section]):
        return
    base.FEEDS[section].insert(0, (source, base.google_news(query)))


# Madison and Wisconsin: prioritize useful local reporting and official civic updates.
LOCAL_FEEDS = [
    ("City of Madison", 'site:cityofmadison.com/news Madison Wisconsin when:7d'),
    ("Dane County", 'site:danecounty.gov/press Dane County Wisconsin when:7d'),
    ("Wisconsin Watch", 'site:wisconsinwatch.org Wisconsin when:7d'),
    ("Wisconsin Examiner", 'site:wisconsinexaminer.com Wisconsin when:7d'),
    ("Isthmus", 'site:isthmus.com Madison Wisconsin when:7d'),
    ("Channel 3000", 'site:channel3000.com Madison Wisconsin when:3d'),
    ("Madison365", 'site:madison365.com Madison Wisconsin when:7d'),
]

# Nature and animals: mix Wisconsin-specific conservation with broader science reporting.
ANIMAL_NATURE_FEEDS = [
    ("Wisconsin DNR", 'site:dnr.wisconsin.gov/newsroom wildlife conservation Wisconsin when:14d'),
    ("Henry Vilas Zoo", 'site:henryvilaszoo.gov animals conservation when:30d'),
    ("Smithsonian Animals", 'site:smithsonianmag.com animals wildlife conservation when:7d'),
    ("Mongabay", 'site:mongabay.com wildlife conservation animals when:7d'),
    ("National Geographic Wildlife", 'site:nationalgeographic.com animals wildlife when:7d'),
    ("Audubon", 'site:audubon.org birds conservation when:7d'),
]

# Science and wellbeing: emphasize primary institutions and evidence-based reporting.
SCIENCE_WELLBEING_FEEDS = [
    ("NIH News", 'site:nih.gov/news-events health research when:7d'),
    ("NIMH Science", 'site:nimh.nih.gov/news mental health research ADHD autism when:14d'),
    ("CDC Newsroom", 'site:cdc.gov/media health public health when:7d'),
    ("UW Health", 'site:uwhealth.org/news health research Madison when:14d'),
    ("UW-Madison Science", 'site:wisc.edu science research Madison when:14d'),
    ("ScienceDaily Neuroscience", 'site:sciencedaily.com neuroscience psychology ADHD autism when:7d'),
    ("Medical Xpress", 'site:medicalxpress.com psychology neuroscience mental health when:7d'),
    ("NIEHS", 'site:niehs.nih.gov/news environmental health research when:14d'),
]

for source, query in reversed(LOCAL_FEEDS):
    add_feed("local", source, query)

for source, query in reversed(ANIMAL_NATURE_FEEDS):
    add_feed("animals", source, query)

for source, query in reversed(SCIENCE_WELLBEING_FEEDS):
    add_feed("wellbeing", source, query)


if __name__ == "__main__":
    personalized.main()
