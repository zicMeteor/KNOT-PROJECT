# 결과보고서 집계: 쌓인 사용 기록을 숫자와 표로 뽑는다 (DB는 읽기만 한다)
#
# src 폴더에서:
#   python -m scripts.report                         테스트 기간(테스터)과 공학제(부스)를 따로 집계
#   python -m scripts.report --group tester          테스터만
#   python -m scripts.report --from 2026-10-16 --to 2026-10-25 --group tester
#   python -m scripts.report --assist-from 2026-10-18   실패 처리를 켠 날을 직접 지정 (기본: server_start 기록에서 찾음)
#
# 결과: 화면 요약 + 저장소 밖 reports/<시각>/ 에 지표별 CSV와 report.md
# 사람 이름·아이디는 쓰지 않는다 (테스터 A, B, C). --names를 주면 아이디로 보여 준다 (본인 확인용)
import argparse
import csv
import json
import statistics
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

from database.database import SessionLocal
from database.models import (
    aiusage_class, content_class, eventlog_class, feedback_class, graphsnapshot_class, users_class,
)

PERIODS = {
    "tester": ("테스트 기간 (테스터)", "tester", date(2026, 10, 16), date(2026, 10, 25)),
    "booth": ("공학제 시연 (부스)", "booth", date(2026, 10, 26), date(2026, 10, 30)),
}
OUT_ROOT = Path(__file__).resolve().parents[2] / "reports"
CODE_LABEL = {
    "FETCH_FAIL": "페이지를 못 받음", "LOGIN_WALL": "로그인 필요", "NO_TEXT": "본문 없음", "TOO_SHORT": "본문 짧음",
    "PDF_NO_TEXT": "스캔 PDF", "PDF_LOCKED": "암호 PDF", "PDF_TOO_BIG": "큰 PDF", "DUPLICATE": "이미 저장",
    "AI_QUOTA": "AI 한도", "AI_FAIL": "AI 실패", "INVALID": "입력 오류",
}


# ---------- 작은 도구 ----------

def pct(n, d):
    """비율과 바탕 건수를 함께: 87% (40/46). 표본이 작으니 건수를 꼭 같이 보여 준다"""
    return f"{n / d:.0%} ({n}/{d})" if d else f"- (0/0)"


def secs(values):
    if not values:
        return "-"
    values = sorted(values)
    p90 = values[min(len(values) - 1, int(len(values) * 0.9))]
    return f"중앙 {statistics.median(values) / 1000:.1f}초, 느린 10% {p90 / 1000:.1f}초 (n={len(values)})"


def detail_of(row):
    try:
        return json.loads(row.detail or "{}")
    except (TypeError, ValueError):
        return {}


class Section:
    """한 구간의 결과: 보고서 문단(md)과 CSV 표들"""

    def __init__(self, title):
        self.title = title
        self.lines = []
        self.tables = {}

    def h(self, text):
        self.lines += ["", f"### {text}"]

    def kv(self, label, value):
        self.lines.append(f"- {label}: {value}")

    def note(self, text):
        self.lines.append(f"  - {text}")

    def table(self, name, header, rows):
        self.tables[name] = (header, rows)
        if rows:
            self.lines += ["", "| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
            self.lines += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
            self.lines.append("")


# ---------- 데이터 읽기 ----------

def load(db, role, start, end):
    users = db.query(users_class).filter(users_class.role == role).order_by(users_class.users_id).all()
    ids = [u.users_id for u in users]
    lo, hi = datetime.combine(start, datetime.min.time()), datetime.combine(end + timedelta(days=1), datetime.min.time())
    in_range = lambda col: (col >= lo) & (col < hi)  # noqa: E731
    events = [] if not ids else db.query(eventlog_class).filter(
        eventlog_class.users_id.in_(ids), in_range(eventlog_class.created_at)).order_by(eventlog_class.EventLog_id).all()
    # 로그인 실패는 사용자 번호 없이 아이디만 남는다
    names = {u.username for u in users}
    login_fails = [e for e in db.query(eventlog_class).filter(
        eventlog_class.event == "login", eventlog_class.ok.is_(False), in_range(eventlog_class.created_at)).all()
        if detail_of(e).get("username") in names]
    feedback = [] if not ids else db.query(feedback_class).filter(
        feedback_class.users_id.in_(ids), in_range(feedback_class.created_at)).all()
    usage = [] if not ids else db.query(aiusage_class).filter(
        aiusage_class.users_id.in_(ids), in_range(aiusage_class.created_at)).all()
    snaps = [] if not ids else db.query(graphsnapshot_class).filter(
        graphsnapshot_class.users_id.in_(ids), graphsnapshot_class.day >= start, graphsnapshot_class.day <= end
    ).order_by(graphsnapshot_class.day).all()
    contents = [] if not ids else db.query(content_class).filter(content_class.users_id.in_(ids)).all()
    starts = db.query(eventlog_class).filter(eventlog_class.event == "server_start").order_by(eventlog_class.EventLog_id).all()
    return users, events, login_fails, feedback, usage, snaps, contents, starts


def assist_split(starts, start, end, override):
    """실패 처리를 켠 때. 돌려주는 값: (켠 시각 또는 None, 설명)
    기간 시작 전에 이미 켜져 있었으면 기간 시작 시각을 돌려준다 (기간 내내 켜짐)"""
    lo = datetime.combine(start, datetime.min.time())
    hi = datetime.combine(end + timedelta(days=1), datetime.min.time())
    if override:
        return max(datetime.fromisoformat(override), lo), "직접 지정"
    before = [s for s in starts if s.created_at < lo]
    if before and detail_of(before[-1]).get("failure_assist"):
        return lo, "기간 시작 전부터 켜져 있음"
    for s in starts:
        if lo <= s.created_at < hi and detail_of(s).get("failure_assist"):
            return s.created_at, "server_start 기록"
    return None, "기간 동안 켠 기록이 없음 (--assist-from으로 지정 가능)"


# ---------- 집계 ----------

def build(db, key, start, end, assist_override, show_names):
    title, role, *_ = PERIODS[key]
    users, events, login_fails, feedback, usage, snaps, contents, starts = load(db, role, start, end)
    sec = Section(f"{title} {start:%m.%d}~{end:%m.%d}")
    if key == "tester":
        label = {u.users_id: (u.username if show_names else f"테스터 {chr(65 + i)}") for i, u in enumerate(users)}
    else:
        label = {u.users_id: u.username for u in users}  # booth26 같은 날짜별 계정 (개인이 아니다)
    by = defaultdict(list)
    for e in events:
        e.d = detail_of(e)
        by[e.event].append(e)

    # 개요
    sec.h("개요")
    active = {e.users_id for e in events if e.event not in ("login",)}
    sec.kv("계정", f"{len(users)}개 중 {len(active)}개가 사용")
    saves = [e for e in by["save"] if e.ok]
    sec.kv("저장한 자료", f"{len(saves)}건")
    if key == "booth":
        sec.note("부스 계정은 하루 동안 여러 방문객이 함께 써서, 방문객 한 명 단위로는 나누지 않는다. 미리 넣어 둔 기본 자료는 세지 않는다")
    days_by_user = defaultdict(set)
    for e in events:
        days_by_user[e.users_id].add(e.created_at.date())
    rows = []
    for u in users:
        mine = [e for e in saves if e.users_id == u.users_id]
        rows.append([label[u.users_id], len(mine), len(days_by_user[u.users_id]),
                     sum(1 for e in by["search"] if e.users_id == u.users_id),
                     sum(1 for c in contents if c.users_id == u.users_id and not c.is_seed)])
    sec.table("계정별", ["계정", "저장", "사용한 날", "AI 검색", "지금 자료 수(기본 자료 빼고)"], rows)
    per_day = Counter(e.created_at.date() for e in saves)
    day = start
    rows = []
    while day <= end:
        rows.append([f"{day:%m.%d}", per_day.get(day, 0)])
        day += timedelta(days=1)
    sec.table("날짜별_저장", ["날짜", "저장"], rows)

    # 분석
    sec.h("분석")
    analyses = by["analyze_url"] + by["analyze_pdf"] + by["analyze_paste"]
    real = [e for e in analyses if e.d.get("code") not in ("DUPLICATE", "AI_QUOTA")]
    ok = [e for e in real if e.ok]
    sec.kv("분석 성공률", pct(len(ok), len(real)))
    sec.note("이미 저장한 주소, AI 한도 초과는 분석 실패로 세지 않는다")
    for name, evs in (("링크", by["analyze_url"]), ("PDF", by["analyze_pdf"]), ("붙여넣기", by["analyze_paste"])):
        r = [e for e in evs if e.d.get("code") not in ("DUPLICATE", "AI_QUOTA")]
        if r:
            sec.note(f"{name}: {pct(sum(1 for e in r if e.ok), len(r))}")
    sec.kv("분석 시간", secs([e.ms for e in ok if e.ms]))
    short = sum(1 for e in ok if e.d.get("analysis_status") == "ai_short")
    trunc = sum(1 for e in ok if e.d.get("truncated"))
    sec.kv("짧은 본문으로 분석", pct(short, len(ok)))
    sec.kv("긴 글이라 앞부분만 분석", pct(trunc, len(ok)))
    tags_total = sum(e.d.get("tags") or 0 for e in ok)
    new_total = sum(e.d.get("new_tags") or 0 for e in ok)
    sec.kv("AI가 고른 태그 중 이미 쓰던 태그", pct(tags_total - new_total, tags_total))
    fails = Counter(e.d.get("code") or "기타" for e in analyses if not e.ok)
    sec.table("실패_이유", ["이유", "코드", "건수"], [[CODE_LABEL.get(c, c), c, n] for c, n in fails.most_common()])

    # 저장과 AI 제안 수정
    sec.h("저장과 AI 제안")
    via = Counter(e.d.get("via") or "analyze" for e in saves)
    via_name = {"analyze": "보통 분석", "paste": "붙여넣기 분석", "manual": "메모로 저장"}
    sec.kv("저장 경로", ", ".join(f"{via_name.get(k, k)} {v}건" for k, v in via.most_common()) or "-")
    ai_saves = [e for e in saves if (e.d.get("via") or "analyze") in ("analyze", "paste")]
    discards = by["discard"]
    sec.kv("분석 뒤 저장한 비율 (저장 / (저장+취소))", pct(len(ai_saves), len(ai_saves) + len(discards)))
    judged = [e for e in ai_saves if "category_changed" in e.d]
    cat_changed = sum(1 for e in judged if e.d.get("category_changed"))
    tag_changed = sum(1 for e in judged if (e.d.get("tags_added") or 0) or (e.d.get("tags_removed") or 0))
    any_changed = sum(1 for e in judged if e.d.get("category_changed") or (e.d.get("tags_added") or 0) or (e.d.get("tags_removed") or 0))
    sec.kv("AI 제안을 고쳐서 저장", pct(any_changed, len(judged)))
    sec.note(f"카테고리를 바꿈 {pct(cat_changed, len(judged))}, 태그를 더하거나 뺌 {pct(tag_changed, len(judged))}")
    if judged:
        sec.note(f"평균 태그 추가 {statistics.mean(e.d.get('tags_added') or 0 for e in judged):.2f}개, "
                 f"삭제 {statistics.mean(e.d.get('tags_removed') or 0 for e in judged):.2f}개")

    # 실패 처리 전후
    split, how = assist_split(starts, start, end, assist_override)
    period_lo = datetime.combine(start, datetime.min.time())
    sec.h("실패 처리 전후")
    sec.kv("실패 처리를 켠 때", how if split is None or split == period_lo else f"{split:%m.%d %H:%M} ({how})")
    saved_urls = {}
    for e in saves:
        if e.d.get("url"):
            saved_urls.setdefault(e.d["url"].rstrip("/"), e.created_at)
    rows = []
    if split is None:
        parts = (("꺼진 상태 (기간 전체)", lambda t: True),)
    elif split == period_lo:
        parts = (("켜진 상태 (기간 전체)", lambda t: True),)
    else:
        parts = (("켜기 전", lambda t: t < split), ("켠 뒤", lambda t: t >= split))
    for name, cond in parts:
        part = [e for e in real if cond(e.created_at)]
        failed_urls = {}
        for e in part:
            if not e.ok and e.event == "analyze_url" and e.d.get("url"):
                failed_urls.setdefault(e.d["url"].rstrip("/"), e.created_at)
        rescued = sum(1 for u, t in failed_urls.items() if u in saved_urls and saved_urls[u] >= t)
        rescue_via = Counter(e.d.get("via") for e in saves if cond(e.created_at) and e.d.get("via") in ("paste", "manual"))
        rows.append([name, pct(sum(1 for e in part if not e.ok), len(part)), pct(rescued, len(failed_urls)),
                     rescue_via.get("paste", 0), rescue_via.get("manual", 0)])
    sec.table("실패_처리_전후", ["구간", "분석 실패율", "실패한 링크가 결국 저장된 비율", "붙여넣기 저장", "메모 저장"], rows)

    # 다시 찾기
    sec.h("다시 찾기")
    searches = [e for e in by["search"] if e.ok]
    zero = sum(1 for e in searches if not e.d.get("count"))
    sec.kv("AI 검색", f"{len(searches)}번, 0건 {pct(zero, len(searches))}")
    opened_queries = {(e.users_id, e.d.get("query")) for e in by["search_open"]}
    with_result = [e for e in searches if e.d.get("count")]
    opened = sum(1 for e in with_result if (e.users_id, e.d.get("query")) in opened_queries)
    sec.kv("결과가 있던 AI 검색 중 결과를 연 비율", pct(opened, len(with_result)))
    lib = Counter((e.d.get("via") or "list") + ("+검색어" if e.d.get("query") else "") for e in by["library_open"])
    graph_tags = Counter(e.d.get("via") or "-" for e in by["graph_tag_open"])
    sec.table("찾는_길별_열람", ["길", "자료를 연 횟수"], [
        ["AI 검색 결과", len(by["search_open"])],
        ["전체 자료 (검색어로 거른 목록)", lib.get("list+검색어", 0)],
        ["전체 자료 (거르지 않은 목록)", lib.get("list", 0)],
        ["전체 자료 (같은 태그 자료를 따라감)", lib.get("related", 0)],
        ["지식 그래프 (태그·실 목록)", len(by["graph_item_open"])],
    ])
    sec.kv("지식 그래프에서 태그를 고른 횟수", ", ".join(f"{k} {v}" for k, v in graph_tags.most_common()) or "-")
    sec.note("목록·그래프 열람 기록은 이 기능을 넣은 뒤부터 쌓인다")

    # 재분류
    sec.h("목적에 맞게 다시 묶기")
    previews = [e for e in by["reclassify_preview"] if e.ok]
    proposed = sum(e.d.get("proposed") or 0 for e in previews)
    applies = by["reclassify_apply"]
    applied = sum(e.d.get("applied") or 0 for e in applies)
    sec.kv("검토", f"{len(previews)}번 ({sum(e.d.get('reviewed') or 0 for e in previews)}건 검토, 바꿀 안 {proposed}건)")
    sec.kv("바꿀 안 중 적용한 비율", pct(applied, proposed))
    sec.kv("목적 예", " / ".join(sorted({e.d.get("purpose") for e in previews if e.d.get("purpose")})[:5]) or "-")

    # 좋아요·싫어요
    sec.h("👍/👎")
    rows = []
    for target, name in (("analysis", "분석 결과"), ("search", "AI 검색 결과"), ("reclassify", "재분류 제안")):
        f = [x for x in feedback if x.target == target]
        rows.append([name, sum(1 for x in f if x.value == 1), sum(1 for x in f if x.value == -1), pct(sum(1 for x in f if x.value == 1), len(f))])
    sec.table("좋아요_싫어요", ["대상", "👍", "👎", "👍 비율"], rows)

    # 지식 그래프 성장
    sec.h("지식 그래프 성장")
    first, last = {}, {}
    for s in snaps:
        first.setdefault(s.users_id, s)
        last[s.users_id] = s
    rows = []
    for u in users:
        if u.users_id in first:
            a, b = first[u.users_id], last[u.users_id]
            rows.append([label[u.users_id], f"{a.day:%m.%d}→{b.day:%m.%d}", f"{a.contents}→{b.contents}", f"{a.tags}→{b.tags}",
                         f"{a.links}→{b.links}", f"{a.isolated}→{b.isolated}", f"{(b.links / b.tags if b.tags else 0):.2f}"])
    sec.table("그래프_성장", ["계정", "기간", "자료", "태그", "연결", "떨어진 태그", "태그당 연결"], rows)
    sec.note("그래프 기록은 계정마다 그날 처음 들어올 때 한 줄씩 남는다 (안 들어온 날은 없음)")

    # 그 밖
    sec.h("그 밖")
    sec.kv("AI 사용", ", ".join(f"{k} {v}회" for k, v in Counter(x.kind for x in usage).most_common()) or "-")
    sec.kv("AI 한도에 걸림", f"{sum(1 for e in events if e.d.get('code') == 'AI_QUOTA')}번")
    sec.kv("삭제", f"{len(by['delete'])}건 (기본 자료 {sum(1 for e in by['delete'] if e.d.get('is_seed'))}건)")
    sec.kv("로그인 실패", f"{len(login_fails)}번")
    return sec


def main():
    ap = argparse.ArgumentParser(description="KNOT 결과보고서 집계")
    ap.add_argument("--group", choices=["tester", "booth", "both"], default="both")
    ap.add_argument("--from", dest="start", type=date.fromisoformat)
    ap.add_argument("--to", dest="end", type=date.fromisoformat)
    ap.add_argument("--assist-from", help="실패 처리를 켠 때 (예: 2026-10-18 또는 2026-10-18T09:00)")
    ap.add_argument("--names", action="store_true", help="테스터를 A/B/C 대신 아이디로")
    args = ap.parse_args()

    keys = ["tester", "booth"] if args.group == "both" else [args.group]
    db = SessionLocal()
    sections = []
    try:
        for key in keys:
            _, _, d_start, d_end = PERIODS[key]
            start, end = args.start or d_start, args.end or d_end
            sections.append((key, build(db, key, start, end, args.assist_from, args.names)))
    finally:
        db.close()

    out = OUT_ROOT / datetime.now().strftime("%Y%m%d_%H%M%S")
    out.mkdir(parents=True, exist_ok=True)
    md = [f"# KNOT 결과보고서 집계 ({datetime.now():%Y-%m-%d %H:%M})", "",
          "표본이 작아 비율은 참고용이다. 비율 옆 괄호가 바탕 건수다."]
    for key, sec in sections:
        md += ["", f"## {sec.title}"] + sec.lines
        for name, (header, rows) in sec.tables.items():
            with (out / f"{key}_{name}.csv").open("w", newline="", encoding="utf-8-sig") as f:
                w = csv.writer(f)
                w.writerow(header)
                w.writerows(rows)
    text = "\n".join(md) + "\n"
    (out / "report.md").write_text(text, encoding="utf-8")
    print(text)
    print(f"저장: {out}")


if __name__ == "__main__":
    main()
