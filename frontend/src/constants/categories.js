// 카테고리별 노드 색. 어두운 배경에서 구분되는 6색
export const CATEGORY_COLORS = {
  학습: "#60a5fa",
  참고: "#34d399",
  연구: "#a78bfa",
  아이디어: "#f472b6",
  도구: "#fb923c",
  기타: "#94a3b8",
}

const DEFAULT_COLOR = "#a1a1aa"

export function categoryColor(name) {
  return CATEGORY_COLORS[name] ?? DEFAULT_COLOR
}