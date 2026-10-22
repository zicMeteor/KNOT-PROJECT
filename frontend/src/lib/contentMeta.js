// 자료 한 건을 화면에 보여 줄 때 쓰는 작은 도구들 (출처, 종류, 날짜, 태그 이름)

export function tagName(t) {
  return typeof t === "string" ? t : t?.name ?? ""
}

// 사용자가 넣은 주소를 다듬는다. 주소창에서 복사하면 https://가 빠지는 일이 많아,
// 앞에 붙은 방식이 없고 도메인처럼 보이면(점이 있고 빈칸이 없으면) https://를 붙인다
// mailto:처럼 다른 방식이 붙은 글자나, 도메인 앞에 @가 있는 글자(user@host)는 붙이지 않는다
// (붙이면 https://mailto:a@b.com처럼 엉뚱한 사이트 주소가 된다. 포트 example.com:8080은 붙인다)
export function normalizeUrl(input) {
  const s = (input ?? "").trim()
  if (!s || /^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s) || s.split("/")[0].includes("@")) return s
  if (/^[^\s/]+\.[^\s/]+/.test(s) && !/\s/.test(s)) return "https://" + s
  return s
}

// 출처: 주소가 있으면 도메인만 (www. 제외), 없으면 PDF로 올린 자료
export function hostOf(url) {
  if (!url) return "PDF"
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

// 자료 종류: 출처 주소로 짐작한다. 카드 생김새와 이름표에 쓴다
// (서버가 종류를 알려 주지 않으므로 짐작이 틀릴 수 있다. 틀려도 "글"로 보일 뿐이다)
export function kindOf(url) {
  if (!url) return { key: "pdf", label: "PDF 문서" }
  const host = hostOf(url)
  if (/(^|\.)arxiv\.org$|(^|\.)openreview\.net$|(^|\.)aclanthology\.org$/.test(host))
    return { key: "paper", label: "논문" }
  if (/^github\.com$|^gitlab\.com$/.test(host)) return { key: "repo", label: "코드 저장소" }
  if (/^docs\.|^developer\.|\.readthedocs\.io$|^learn\.microsoft\.com$/.test(host))
    return { key: "doc", label: "공식 문서" }
  return { key: "post", label: "글" }
}

// "2026-10-07T11:41:41" → "2026-10-07". 시간대 변환 없이 문자열에서 날짜만 자른다
// (Date로 바꾸면 시간대 때문에 하루 밀릴 수 있다)
export function dayOf(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""))
  return m ? m[0] : null
}

// "2026-10-07" → "10.07"
export function shortDay(day) {
  return day ? day.slice(5).replace("-", ".") : ""
}

// "2026-10-07" → "2026.10.07"
export function fullDay(day) {
  return day ? day.replace(/-/g, ".") : ""
}

// 이미 쓰는 태그 (소문자 → 이름). 태그를 고칠 때 새 태그인지 가리고, 고를 목록으로 보여 준다
export function knownTags(contents) {
  const map = new Map()
  for (const c of contents) {
    for (const t of c.tags ?? []) {
      const name = tagName(t)
      if (!map.has(name.toLowerCase())) map.set(name.toLowerCase(), name)
    }
  }
  return map
}

// AI 없이 메모로 저장한 자료 (요약이 없고, 다시 분석할 수 있다)
export function isUnanalyzed(c) {
  return c.analysisStatus === "manual" || c.analysisStatus === "pending"
}

// 두 자료가 함께 가진 태그 (대소문자 무시, 앞 자료의 표기로)
export function sharedTags(a, b) {
  const other = new Set((b.tags ?? []).map((t) => tagName(t).toLowerCase()))
  return (a.tags ?? []).map(tagName).filter((t) => other.has(t.toLowerCase()))
}
