// 홈 스크롤 고정 구간 공통: 구역을 화면에 고정해 두고, 스크롤한 거리를 0~1 진행도로 바꾼다
import { useCallback, useEffect, useState } from "react"
import { reducedMotion } from "./threadGraph"

// 스크롤 고정은 넓은 화면에서만 쓴다 (좁은 화면은 내용이 세로로 쌓여서 의미가 없다)
export function canPin() {
  return !reducedMotion() && window.matchMedia("(min-width: 901px)").matches
}

// trackRef: 고정 구간 전체 (높이를 이 함수가 정한다), stageRef: 그 안에서 화면에 고정되는 부분
// screens: 고정 구간 길이 (고정되는 부분 높이의 배수). 1이면 고정 없이 지나간다
// 반환: on = 고정을 쓰는지, p = 진행도 (0~1), seek(p) = 그 진행도 위치로 스크롤
export function usePinProgress(trackRef, stageRef, screens) {
  const [on, setOn] = useState(false)
  const [p, setP] = useState(0)

  useEffect(() => {
    const track = trackRef.current
    const stage = stageRef.current
    if (!track || !stage || !canPin()) return
    setOn(true)
    function onScroll() {
      const ph = stage.offsetHeight
      track.style.height = ph * screens + "px"
      const r = track.getBoundingClientRect()
      const v = Math.max(0, Math.min(1, -r.top / (ph * (screens - 1))))
      // 아주 작은 변화로 다시 그리지 않게 0.001 단위로 맞춘다
      setP(Math.round(v * 1000) / 1000)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    onScroll()
    // 고정 모양(on)이 그려지거나 화면 크기가 바뀌어 stage 높이가 달라지면 다시 잰다
    const ro = new ResizeObserver(onScroll)
    ro.observe(stage)
    return () => {
      ro.disconnect()
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      track.style.height = ""
      setOn(false)
    }
  }, [trackRef, stageRef, screens])

  const seek = useCallback(
    (v) => {
      const track = trackRef.current
      const stage = stageRef.current
      if (!track || !stage) return
      const top = track.getBoundingClientRect().top + window.scrollY
      const range = stage.offsetHeight * (screens - 1)
      window.scrollTo({ top: top + Math.max(0, Math.min(1, v)) * range, behavior: "smooth" })
    },
    [trackRef, stageRef, screens]
  )

  return { on, p, seek }
}

// 고정 없이 지나가는 구역: 요소가 화면 아래에서 올라와 지나가는 정도를 0~1로 돌려준다
// 요소 윗변이 화면 높이의 startAt 지점에 닿으면 0, 요소 높이의 span배만큼 더 올라가면 1
// 움직임 줄이기 설정이면 처음부터 1 (마지막 모습)
export function useViewProgress(ref, { startAt = 0.85, span = 0.9 } = {}) {
  const [p, setP] = useState(() => (reducedMotion() ? 1 : 0))

  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion()) return
    function onScroll() {
      const r = el.getBoundingClientRect()
      const v = (window.innerHeight * startAt - r.top) / (r.height * span)
      setP(Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    onScroll()
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [ref, startAt, span])

  return p
}
