// 사이드바 열고 닫기 아이콘 (세로선 위치로 왼쪽/오른쪽 구분)
function SidebarIcon({ side }) {
  const x = side === "left" ? 9 : 15
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1={x} y1="4" x2={x} y2="20" />
    </svg>
  )
}

export default SidebarIcon