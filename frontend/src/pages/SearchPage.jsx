import { useState } from "react"
import { useSearch } from "../hooks/useSearch"
import Button from "../components/ui/Button"
import Notice from "../components/ui/Notice"
import SearchResultItem from "../components/SearchResultItem"
import styles from "./SearchPage.module.css"

function SearchPage() {
  const [input, setInput] = useState("")
  const { status, result, error, run, cancel } = useSearch()
  const loading = status === "loading"

  function handleSubmit(e) {
    e.preventDefault()
    run(input)
  }

  // category는 서버가 실제로 필터로 썼을 때만 보여준다
  const analysis = result?.analysis
  const chips = []
  if (analysis?.category_applied && analysis.category) {
    chips.push({ key: "c-" + analysis.category, label: "카테고리 " + analysis.category })
  }
  for (const t of analysis?.tags ?? []) {
    chips.push({ key: "t-" + t, label: "태그 " + t })
  }
  for (const k of analysis?.keywords ?? []) {
    chips.push({ key: "k-" + k, label: "키워드 " + k })
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>검색</h1>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="찾고 싶은 자료를 문장으로 입력하세요"
        />
        {loading ? (
          <Button onClick={cancel}>취소</Button>
        ) : (
          <Button type="submit" variant="primary" disabled={!input.trim()}>
            검색
          </Button>
        )}
      </form>

      {loading && <p className={styles.status}>검색 중…</p>}
      {status === "error" && <Notice type="error">{error}</Notice>}

      {status === "done" && result && (
        <section className={styles.result}>
          <p className={styles.count}>
            “{result.query}” 결과 {result.count}건
          </p>

          {chips.length > 0 && (
            <ul className={styles.chips} aria-label="검색 조건 해석">
              {chips.map((c) => (
                <li key={c.key} className={styles.chip}>
                  {c.label}
                </li>
              ))}
            </ul>
          )}

          {result.count === 0 ? (
            <p className={styles.empty}>결과가 없습니다. 다른 표현으로 검색해 보세요.</p>
          ) : (
            <ul className={styles.list}>
              {result.contents.map((item) => (
                <SearchResultItem key={item.id} item={item} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

export default SearchPage