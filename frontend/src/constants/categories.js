// 카테고리별 색. 어두운 배경(#09090b) 기준으로 명도·채도·색약 구분·대비 검증을 통과한 5색 + 기타(무채색)
export const CATEGORY_COLORS = {
  학습: "#2563eb",
  참고: "#0d9488",
  연구: "#a21caf",
  아이디어: "#c2850c",
  도구: "#e11d48",
  기타: "#71717a",
}

const DEFAULT_COLOR = "#71717a"

export function categoryColor(name) {
  return CATEGORY_COLORS[name] ?? DEFAULT_COLOR
}