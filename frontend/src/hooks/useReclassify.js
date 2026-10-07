import { useRef, useState } from "react"
import { previewReclassify, executeReclassify } from "../api/reclassify"

// step: input | loading | review | applying | result
export function useReclassify({ onApplied, onClose }) {
  const [step, setStep] = useState("input")
  const [purpose, setPurpose] = useState("")
  const [error, setError] = useState(null)
  const [plan, setPlan] = useState(null)
  const [result, setResult] = useState(null)
  const abortRef = useRef(null)

  async function runPreview() {
    const text = purpose.trim()
    if (!text) {
      setError("목적을 입력하세요.")
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setError(null)
    setStep("loading")
    try {
      const data = await previewReclassify(text, ctrl.signal)
      setPlan(data)
      setStep("review")
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message)
      setStep("input")
    }
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
      const data = await executeReclassify(changes)
      if (data.success_count > 0) onApplied(data.success_count)
      if (data.fail_count === 0) {
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
    error,
    plan,
    result,
    runPreview,
    cancelPreview,
    apply,
    backToInput,
  }
}