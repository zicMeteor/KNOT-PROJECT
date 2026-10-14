import { useEffect, useRef, useState } from "react"
import { previewReclassify, executeReclassify } from "../api/reclassify"
import { useAuth } from "./useAuth"

// step: input | loading | review | applying | result
export function useReclassify({ onApplied, onClose }) {
  const [step, setStep] = useState("input")
  const [purpose, setPurpose] = useState("")
  // 검토 범위: null이면 전체, 아니면 카테고리 이름
  const [category, setCategory] = useState(null)
  const [error, setError] = useState(null)
  // 미리보기 뒤 메뉴의 AI 사용 횟수를 새로 읽는다
  const refreshMe = useAuth()?.refresh
  const [plan, setPlan] = useState(null)
  const [result, setResult] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const abortRef = useRef(null)

  useEffect(() => {
    if (step !== "loading") return
    const startedAt = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [step])

  // beforeId가 있으면 같은 목적·범위로 다음 묶음을 본다
  async function runPreview(beforeId = null) {
    const text = purpose.trim()
    if (!text) {
      setError("목적을 입력하세요.")
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setError(null)
    setResult(null)
    setElapsed(0)
    setStep("loading")
    try {
      const data = await previewReclassify({ purpose: text, category, beforeId }, ctrl.signal)
      setPlan(data)
      refreshMe?.()
      setStep("review")
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message)
      setStep(beforeId ? "review" : "input")
    }
  }

  function nextBatch() {
    if (plan?.next_before_id) runPreview(plan.next_before_id)
  }

  function cancelPreview() {
    abortRef.current?.abort()
  }

  async function apply() {
    const changes = plan.actions.filter((a) => a.change_needed)
    if (changes.length === 0) return
    setError(null)
    setStep("applying")
    try {
      const data = await executeReclassify(changes, purpose.trim())
      if (data.success_count > 0) onApplied(data.success_count)
      // 실패도 없고 남은 자료도 없으면 바로 닫는다. 남았으면 결과 화면에서 다음 묶음으로 넘어갈 수 있다
      if (data.fail_count === 0 && !plan.next_before_id) {
        onClose()
        return
      }
      setResult(data)
      setStep("result")
    } catch (e) {
      setError(e.message)
      setStep("review")
    }
  }

  function backToInput() {
    setPlan(null)
    setError(null)
    setStep("input")
  }

  return {
    step,
    purpose,
    setPurpose,
    category,
    setCategory,
    error,
    plan,
    result,
    elapsed,
    runPreview,
    nextBatch,
    cancelPreview,
    apply,
    backToInput,
  }
}