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

# AI and technology: combine official labs and platforms with rigorous tech reporting.
AI_TECH_FEEDS = [
    ("OpenAI News", 'site:openai.com/news OpenAI when:14d'),
    ("Anthropic News", 'site:anthropic.com/news Anthropic Claude when:14d'),
    ("Google DeepMind", 'site:deepmind.google/discover/blog AI research when:14d'),
    ("Google AI", 'site:blog.google/technology/ai artificial intelligence when:14d'),
    ("Microsoft AI", 'site:blogs.microsoft.com AI Copilot when:14d'),
    ("NVIDIA AI", 'site:blogs.nvidia.com AI enterprise when:14d'),
    ("TechCrunch AI", 'site:techcrunch.com/category/artificial-intelligence AI when:7d'),
    ("VentureBeat AI", 'site:venturebeat.com/ai artificial intelligence enterprise when:7d'),
    ("Wired AI", 'site:wired.com/tag/artificial-intelligence AI when:7d'),
    ("AI Safety", '(AI safety OR AI regulation OR AI governance) when:7d'),
]

# Marketing and marketing operations: prioritize platforms, lifecycle, data, and automation.
MARKETING_FEEDS = [
    ("Salesforce Marketing", 'site:salesforce.com/news/stories marketing CRM AI when:14d'),
    ("HubSpot Product", 'site:hubspot.com/company-news product marketing automation when:14d'),
    ("Klaviyo", 'site:klaviyo.com/blog product marketing automation when:14d'),
    ("Braze", 'site:braze.com/resources/articles customer engagement lifecycle when:14d'),
    ("Iterable", 'site:iterable.com/blog lifecycle marketing AI when:14d'),
    ("MarketingOps", 'site:marketingops.com marketing operations when:14d'),
    ("Chief Martec", 'site:chiefmartec.com martech marketing technology when:14d'),
    ("Search Engine Land", 'site:searchengineland.com marketing AI analytics when:7d'),
    ("Adweek", 'site:adweek.com marketing technology brands when:7d'),
    ("Customer Data", '(customer data platform OR CDP OR first-party data OR identity resolution) marketing when:14d'),
    ("Lifecycle Marketing", '(lifecycle marketing OR journey orchestration OR email automation) when:14d'),
    ("B2B Marketing Ops", '(B2B marketing operations OR lead scoring OR revenue operations) when:14d'),
]

for source, query in reversed(LOCAL_FEEDS):
    add_feed("local", source, query)

for source, query in reversed(ANIMAL_NATURE_FEEDS):
    add_feed("animals", source, query)

for source, query in reversed(SCIENCE_WELLBEING_FEEDS):
    add_feed("wellbeing", source, query)

for source, query in reversed(AI_TECH_FEEDS):
    add_feed("ai-tech", source, query)

for source, query in reversed(MARKETING_FEEDS):
    add_feed("work-marketing", source, query)


if __name__ == "__main__":
    personalized.main()
