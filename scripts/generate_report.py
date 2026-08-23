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
    "local": 72, "must-know": 48, "ai-tech": 72, "work-marketing": 168,
    "wellbeing": 120, "entertainment": 168, "animals": 120, "wonderful": 168,
}


def google_news(query: str) -> str:
    return f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en-US&gl=US&ceid=US:en"


FEEDS: dict[str, list[tuple[str, str]]] = {
    "local": [("Wisconsin Public Radio", "https://www.wpr.org/feed"), ("Madison Local", google_news("Madison Wisconsin news when:2d")), ("Wisconsin News", google_news("Wisconsin news when:2d")), ("Dane County", google_news("Dane County Madison news when:3d"))],
    "must-know": [("NPR", "https://feeds.npr.org/1001/rss.xml"), ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"), ("BBC US & Canada", "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml"), ("Reuters", google_news("Reuters top news when:1d")), ("Associated Press", google_news("Associated Press top news when:1d"))],
    "ai-tech": [("MIT Technology Review", "https://www.technologyreview.com/feed/"), ("BBC Technology", "https://feeds.bbci.co.uk/news/technology/rss.xml"), ("The Verge", "https://www.theverge.com/rss/index.xml"), ("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"), ("AI News", google_news("artificial intelligence OpenAI Anthropic Google AI when:2d"))],
    "work-marketing": [("MarTech", "https://martech.org/feed/"), ("HubSpot Marketing", "https://blog.hubspot.com/marketing/rss.xml"), ("Marketing Brew", "https://www.marketingbrew.com/feed"), ("Salesforce", google_news("Salesforce marketing automation CRM when:7d")), ("Marketing Ops", google_news("marketing operations automation analytics when:7d"))],
    "wellbeing": [("BBC Health", "https://feeds.bbci.co.uk/news/health/rss.xml"), ("ScienceDaily Mind & Brain", "https://www.sciencedaily.com/rss/mind_brain.xml"), ("NIMH", "https://www.nimh.nih.gov/site-info/index-rss"), ("Mental Health", google_news("mental health psychology ADHD autism research when:3d")), ("Behavioral Health", google_news("behavioral health technology EHR therapy when:7d"))],
    "entertainment": [("Taylor Alert", google_news('"Taylor Swift" when:7d')), ("Variety", "https://variety.com/feed/"), ("BBC Entertainment", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"), ("NPR Music", "https://feeds.npr.org/1039/rss.xml"), ("Pitchfork", "https://pitchfork.com/rss/news/")],
    "animals": [("Smithsonian", "https://www.smithsonianmag.com/rss/smart-news/"), ("BBC Science", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"), ("Animals", google_news("animals pets wildlife rescue conservation when:3d"))],
    "wonderful": [("Good News Network", "https://www.goodnewsnetwork.org/feed/"), ("Positive News", "https://www.positive.news/feed/"), ("Wonderful News", google_news("uplifting inspiring community kindness rescue when:3d"))],
}

ANIMAL_TERMS = {"animal", "animals", "dog", "dogs", "puppy", "puppies", "cat", "cats", "kitten", "kittens", "pet", "pets", "wildlife", "bird", "birds", "bear", "bears", "wolf", "wolves", "whale", "whales", "dolphin", "dolphins", "elephant", "elephants", "horse", "horses", "rabbit", "rabbits", "fox", "foxes", "otter", "otters", "capybara", "zoo", "species", "habitat", "conservation", "rescue", "shelter", "veterinary", "veterinarian", "marine life", "insect", "insects", "bee", "bees", "butterfly", "butterflies", "turtle", "turtles", "shark", "sharks", "penguin", "penguins", "primate", "primates", "monkey", "monkeys", "gorilla", "gorillas", "lion", "lions", "tiger", "tigers", "deer", "moose", "bison", "seal", "seals", "octopus", "fish", "frog", "frogs"}
ANIMAL_REJECT_PHRASES = {"market analysis", "market size", "forecast, size, trends", "how to watch", "championship", "major tournament", "golf", "basketball", "football", "baseball", "tennis", "headphones", "earbuds", "stock price", "shares rise", "shopping guide"}
IMPORTANT_WORDS = {"election": 6, "president": 6, "congress": 5, "supreme court": 6, "war": 6, "ceasefire": 6, "economy": 5, "inflation": 5, "jobs": 4, "interest rates": 5, "federal reserve": 5, "breaking": 5, "emergency": 6, "wildfire": 5, "flood": 5, "hurricane": 5, "tornado": 5, "law": 4, "policy": 4, "rights": 5, "abortion": 5, "lgbtq": 5, "education": 4, "openai": 4, "anthropic": 4, "artificial intelligence": 4, "cybersecurity": 4, "data breach": 5, "wisconsin": 3, "madison": 4, "dane county": 4, "uw-madison": 4, "taylor swift": 5}
SOURCE_WEIGHT = {"Reuters": 7, "Associated Press": 7, "NPR": 6, "BBC World": 6, "BBC US & Canada": 6, "Wisconsin Public Radio": 6, "MIT Technology Review": 5, "The Verge": 4, "Ars Technica": 4, "Variety": 4}
CAPYBARA_MESSAGES = ["You do not have to solve the whole forest before breakfast. Find the next clear step and put one paw there.", "Urgency is often just anxiety wearing a tiny management badge. Breathe before you promote it.", "A steady morning is not wasted time. Roots are doing work even when nobody applauds them.", "Protect your attention. It is a garden, not a public parking lot.", "Begin with the task that makes the rest of the day feel less haunted.", "Some problems are not yours to carry. Put the backpack down and see who finally notices it has handles.", "Today does not need a heroic version of you. It needs an honest one with water nearby.", "Do not confuse being needed with being supported. Those are very different ecosystems.", "The loudest request is not automatically the most important one. Volume is not governance.", "Your nervous system is not a customer-service desk. It may close the window without explanation.", "Do one thing before opening the gates to everyone else’s priorities.", "A boundary does not require a closing argument. No is already a complete fence.", "You may disappoint someone and still be behaving responsibly. Clementine checked the bylaws.", "Stop trying to earn rest from a committee that keeps moving the requirements.", "Your attention is expensive. Quit handing out free samples to every blinking notification.", "Not every wobble is a collapse. Sometimes the bridge is simply reminding you that it can move.", "You are allowed to choose the boring solution that actually works.", "A plan can be kind and still contain teeth.", "Before fixing the whole system, ask whether one small lever would move the day.", "You cannot regulate an entire household by becoming more exhausted than everyone in it.", "Perfection is often procrastination in a blazer. Send the useful version.", "Today’s assignment: notice the moment you start doing someone else’s thinking for them.", "You are not behind. You are carrying too many clocks, several of which belong to other people.", "Let the awkward silence sit there. It arrived without luggage and can leave the same way.", "The day may be crowded. That does not mean every demand gets a chair.", "Choose one thing to protect before the world starts negotiating with you.", "Your brain is offering twelve tabs and a small fire. Pick one tab. The fire may be decorative.", "Competence is not consent to become the emergency contact for everything.", "The next right step may be unimpressive. Take it anyway. Glitter is optional.", "You do not need to make the truth more comfortable before saying it.", "A pause is not a failure of momentum. It is where steering happens.", "Someone else’s confusion is not always your assignment to resolve.", "Today, trade one ounce of overexplaining for one ounce of self-trust.", "There is no prize for answering every question before anyone else has tried thinking.", "If the plan depends on you never getting tired, the plan is garbage.", "Be suspicious of tasks that arrive wearing urgency but carrying no consequences.", "You may care deeply without taking over completely.", "Your worth is not a productivity dashboard, and frankly the dashboard has terrible data hygiene.", "Do not spend premium morning brain on bargain-bin nonsense.", "The people who benefit from your lack of boundaries may file complaints. Let them enjoy the paperwork.", "You are allowed to make today smaller until it fits inside your actual life.", "When everything feels important, choose what will still matter after lunch.", "No one gets your best thinking by scattering it across seventeen tiny emergencies.", "Courage is sometimes sending the email. Sometimes it is refusing to write the fifth version.", "You can be compassionate without becoming absorbent.", "Today’s challenge: leave one solvable problem with the person who owns it.", "A clear answer may feel rude only because chaos has been receiving concierge service.", "Do not negotiate against yourself before anyone else has even entered the room.", "Your pace is allowed to be human, even when the machinery is being dramatic.", "If you keep rescuing the process, the process never learns to stop walking into traffic.", "You do not need a better attitude about an unreasonable load. You need less load.", "Pick the task that creates relief, not merely the task making the most noise.", "You are not required to turn every difficult feeling into an immediate action item.", "A good morning can begin with deciding what will not be allowed to eat it.", "The universe has received your request to control every variable. It has declined with no further comment.", "Be kind to yourself, but not vague. Name the thing. Choose the step. Close a tab.", "Today may ask for flexibility. It does not get unlimited access to your spine.", "Keep one promise to yourself before becoming useful to everyone else.", "Your calm is not evidence that the problem belongs to you.", "Sometimes the profound move is making coffee and refusing to catastrophize before the first sip."]


def clean_text(value: str | None, limit: int = 430) -> str:
    if not value: return "Open the original source for the full details."
    value = re.sub(r"<[^>]+>", " ", value); value = html.unescape(value); value = re.sub(r"\s+", " ", value).strip(); value = re.split(r"\bThe post\b", value, maxsplit=1, flags=re.IGNORECASE)[0].strip(); value = re.sub(r"\s*\[(?:…|\.\.\.)\]\s*$", "", value).strip()
    if not value: return "Open the original source for the full details."
    return value if len(value) <= limit else f"{value[:limit].rsplit(' ', 1)[0]}…"

def entry_timestamp(entry: Any) -> float:
    parsed = entry.get("published_parsed") or entry.get("updated_parsed"); return datetime(*parsed[:6], tzinfo=timezone.utc).timestamp() if parsed else 0

def image_from_entry(entry: Any) -> str:
    for key in ("media_content", "media_thumbnail"):
        for item in entry.get(key) or []:
            if item.get("url"): return item["url"]
    for enclosure in entry.get("enclosures", []) or []:
        href = enclosure.get("href") or enclosure.get("url"); media_type = enclosure.get("type", "")
        if href and ("image" in media_type or re.search(r"\.(jpe?g|png|webp)(\?|$)", href, re.I)): return href
    raw = entry.get("summary") or entry.get("description") or ""; match = re.search(r'<img[^>]+src=["\']([^"\']+)', raw, re.I); return html.unescape(match.group(1)) if match else ""

def title_tokens(title: str) -> set[str]:
    stop = {"the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "as", "is", "are", "from", "at", "by", "after", "new", "says"}; return {word for word in re.findall(r"[a-z0-9]+", title.lower()) if len(word) > 2 and word not in stop}
def headline_similarity(first: str, second: str) -> float:
    a, b = title_tokens(first), title_tokens(second); union = a | b; return len(a & b) / len(union) if union else 0
def is_duplicate(candidate, chosen): return any(candidate["url"] == i.get("url") or headline_similarity(candidate["headline"], i.get("headline", "")) >= .48 for i in chosen)
def contains_term(text, term): return re.search(rf"(?<![a-z0-9]){re.escape(term.lower())}(?![a-z0-9])", text.lower()) is not None
def has_any_term(text, terms): return any(contains_term(text, term) for term in terms)
def looks_like_animal_story(headline, summary):
    text=f"{headline} {summary}".lower(); hh=sum(contains_term(headline,t) for t in ANIMAL_TERMS); th=sum(contains_term(text,t) for t in ANIMAL_TERMS); rejected=any(p in text for p in ANIMAL_REJECT_PHRASES); return (hh>=1 and (not rejected or th>=2)) or (th>=2 and not rejected)
def classify_section(original, headline, summary):
    text=f"{headline} {summary}".lower()
    if original=="wonderful": return "wonderful"
    if has_any_term(text,("madison","dane county","wisconsin","uw-madison","milwaukee")): return "local"
    if "taylor swift" in text or has_any_term(text,("album","concert","film","movie","television","actor","actress","singer","music","netflix","streaming")): return "entertainment"
    if has_any_term(text,("openai","anthropic","artificial intelligence","ai","technology","cybersecurity","software","robot","chip","privacy")): return "ai-tech"
    if has_any_term(text,("marketing","salesforce","hubspot","crm","customer experience","automation","analytics","advertising","brand")): return "work-marketing"
    if has_any_term(text,("mental health","psychology","adhd","autism","therapy","depression","anxiety","health","medical","hospital","disease","drug","treatment")): return "wellbeing"
    if looks_like_animal_story(headline,summary): return "animals"
    return "__reject__" if original=="animals" else original

def first_sentence(text, limit=180):
    sentence=re.split(r"(?<=[.!?])\s+",text.strip())[0].rstrip("."); return sentence if len(sentence)<=limit else sentence[:limit].rsplit(" ",1)[0]
def make_take(section, headline, summary):
    detail=first_sentence(summary); prefixes={"local":"This is close enough to matter beyond the headline", "must-know":"This made the cut because it could shape today’s wider conversation or consequences", "ai-tech":"The useful question is whether this changes how people work, create, protect data, or depend on a platform", "work-marketing":"For your work brain, the important part is the operational consequence", "wellbeing":"The headline is only the doorway. The meaningful point is", "entertainment":"This matters because culture and attention move money, behavior, and conversation", "animals":"The animal angle here is specific, not decorative", "wonderful":"Keep this one for the day"}; return f"{prefixes.get(section,'The useful part of this story is')}: {detail}."
def importance_score(item, now_ts):
    text=f"{item['headline']} {item['summary']}".lower(); score=SOURCE_WEIGHT.get(item["source"],2)+(3 if item["section"]=="must-know" else 0)+(2 if item["section"]=="local" else 0)+(1 if item.get("image") else 0); age=max(0,(now_ts-item["timestamp"])/3600) if item["timestamp"] else 48; return score+max(0,6-age/6)+sum(w for p,w in IMPORTANT_WORDS.items() if p in text)
def is_fresh_enough(item, now_ts): return True if not item["timestamp"] else max(0,(now_ts-item["timestamp"])/3600)<=MAX_AGE_HOURS.get(item["section"],96)

def collect_all(now_ts: float) -> dict[str, list[dict[str, Any]]]:
    results={section:[] for section in FEEDS}; failed=[]
    for original_section, feeds in FEEDS.items():
        for source_name, url in feeds:
            try:
                feed=feedparser.parse(url)
            except Exception as error:
                failed.append(source_name); print(f"WARNING: Skipping unavailable feed {source_name}: {type(error).__name__}: {error}"); continue
            if getattr(feed,"bozo",False) and not getattr(feed,"entries",[]):
                failed.append(source_name); print(f"WARNING: Skipping unreadable feed {source_name}: {getattr(feed,'bozo_exception','unknown parse error')}"); continue
            for entry in feed.entries[:18]:
                link=(entry.get("link") or "").strip(); headline=clean_text(entry.get("title"),190); summary=clean_text(entry.get("summary") or entry.get("description"))
                if not link or not headline: continue
                section=classify_section(original_section,headline,summary)
                if section=="__reject__": continue
                item={"section":section,"source":source_name,"headline":headline,"summary":summary,"url":link,"image":image_from_entry(entry),"timestamp":entry_timestamp(entry),"published":clean_text(entry.get("published") or entry.get("updated"),80)}
                if not is_fresh_enough(item,now_ts): continue
                item["take"]=make_take(section,headline,summary); results.setdefault(section,[]).append(item)
    for section in results: results[section].sort(key=lambda item:item["timestamp"],reverse=True)
    if failed: print(f"Report continued successfully after skipping {len(failed)} unavailable feed(s): {', '.join(failed)}")
    return results

def parse_datetime(value):
    if not value:return None
    try: parsed=datetime.fromisoformat(value.replace("Z","+00:00"))
    except ValueError:return None
    if parsed.tzinfo is None:parsed=parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(REPORT_TZ)
def report_stories(report):
    stories=[]
    if isinstance(report.get("top_story"),dict):stories.append(report["top_story"])
    for ss in (report.get("sections") or {}).values():
        if isinstance(ss,list):stories.extend(s for s in ss if isinstance(s,dict))
    return stories
def history_from_previous_report():
    if not OUTPUT_PATH.exists():return []
    try:report=json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError,OSError):return []
    generated=parse_datetime(report.get("generated_at"))
    if not generated:return []
    return [{"url":s.get("url",""),"headline":s.get("headline",""),"seen_at":generated.isoformat(),"seen_date":generated.date().isoformat()} for s in report_stories(report) if s.get("url") and s.get("headline")]
def load_history(now):
    history=[]
    if HISTORY_PATH.exists():
        try:
            saved=json.loads(HISTORY_PATH.read_text(encoding="utf-8")); history.extend(i for i in saved if isinstance(i,dict)) if isinstance(saved,list) else None
        except (json.JSONDecodeError,OSError):pass
    history.extend(history_from_previous_report()); cutoff=now-timedelta(hours=HISTORY_HOURS); cleaned=[]; seen=set()
    for item in history:
        seen_at=parse_datetime(item.get("seen_at")); key=(item.get("url",""),item.get("headline",""))
        if not seen_at or seen_at<cutoff or not all(key) or key in seen:continue
        cleaned.append(item);seen.add(key)
    return cleaned
def appeared_before(item,history,today): return any(prior.get("seen_date")!=today and (item["url"]==prior.get("url") or headline_similarity(item["headline"],prior.get("headline",""))>=.56) for prior in history)
def choose_diverse(candidates,limit,global_chosen,history,today):
    selected=[];counts=Counter()
    for item in candidates:
        if counts[item["source"]]>=MAX_PER_SOURCE or appeared_before(item,history,today) or is_duplicate(item,global_chosen+selected):continue
        selected.append(item);counts[item["source"]]+=1
        if len(selected)>=limit:break
    return selected
def public_story(item): return None if not item else {k:v for k,v in item.items() if k not in {"timestamp","section","score"}}
def write_history(history,report,now):
    added=[{"url":s.get("url",""),"headline":s.get("headline",""),"seen_at":now.isoformat(),"seen_date":now.date().isoformat()} for s in report_stories(report) if s.get("url") and s.get("headline")]; combined=history+added; unique=[];seen=set()
    for item in reversed(combined):
        key=(item.get("url",""),item.get("headline",""))
        if not all(key) or key in seen:continue
        unique.append(item);seen.add(key)
    HISTORY_PATH.parent.mkdir(parents=True,exist_ok=True);HISTORY_PATH.write_text(json.dumps(list(reversed(unique)),indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
def choose_clementine(now):return CAPYBARA_MESSAGES[now.toordinal()%len(CAPYBARA_MESSAGES)]
def main():
    now_utc=datetime.now(timezone.utc);now_local=now_utc.astimezone(REPORT_TZ);now_ts=now_utc.timestamp();today=now_local.date().isoformat();history=load_history(now_local);pools=collect_all(now_ts);chosen_global=[];sections={};top_pool=pools.get("must-know",[])+pools.get("local",[])+pools.get("ai-tech",[])
    for item in top_pool:item["score"]=importance_score(item,now_ts)
    top_pool.sort(key=lambda i:(i["score"],i["timestamp"]),reverse=True);fresh=[i for i in top_pool if not appeared_before(i,history,today)];top_story=fresh[0] if fresh else (top_pool[0] if top_pool else None)
    if top_story:chosen_global.append(top_story)
    for section in SECTION_ORDER:
        candidates=[i for i in pools.get(section,[]) if not top_story or i["url"]!=top_story["url"]];candidates.sort(key=lambda i:(importance_score(i,now_ts),i["timestamp"]),reverse=True);selected=choose_diverse(candidates,ITEMS_PER_SECTION,chosen_global,history,today);chosen_global.extend(selected);sections[section]=[public_story(i) for i in selected]
    quick_candidates=[]
    for section in SECTION_ORDER:quick_candidates.extend(pools.get(section,[])[:8])
    quick_candidates.sort(key=lambda i:(importance_score(i,now_ts),i["timestamp"]),reverse=True);quick_scan=choose_diverse(quick_candidates,6,chosen_global,history,today)
    report={"generated_at":now_utc.isoformat(),"generated_at_local":now_local.isoformat(),"report_date":today,"top_story":public_story(top_story),"quick_scan":[public_story(i) for i in quick_scan],"sections":sections,"wonderful":sections["wonderful"][0] if sections["wonderful"] else None,"capybara_message":choose_clementine(now_local)}
    OUTPUT_PATH.parent.mkdir(parents=True,exist_ok=True);OUTPUT_PATH.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8");write_history(history,report,now_local);print(f"Wrote {OUTPUT_PATH} for {today} with {sum(len(items) for items in sections.values())} section stories")
if __name__=="__main__":main()
