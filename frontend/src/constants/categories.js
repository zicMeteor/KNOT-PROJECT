// 카테고리별 색 (디자인 시안 "빛의 실"). 검정 배경에서 모두 6.5:1 이상이라 글자 색으로도 읽힌다
// 서로 색상(hue)이 멀어서 그래프의 빛 번짐 속에서도 구분된다. 기타는 무채색
export const CATEGORY_COLORS = {
  학습: "#5b8cff",
  참고: "#2ee6c8",
  연구: "#e15cff",
  아이디어: "#ffc23d",
  도구: "#ff4d6d",
  기타: "#b8b8b8",
}

const DEFAULT_COLOR = "#b8b8b8"

export function categoryColor(name) {
  return CATEGORY_COLORS[name] ?? DEFAULT_COLOR
}