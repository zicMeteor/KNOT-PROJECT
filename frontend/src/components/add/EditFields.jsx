// 저장 전에 카테고리와 태그를 고치는 입력 (분석 결과, 메모 저장에서 함께 쓴다)
import { useId, useState } from "react"
import { CATEGORY_COLORS, categoryColor } from "../../constants/categories"
import styles from "./EditFields.module.css"

const CATEGORIES = Object.keys(CATEGORY_COLORS)
// 서버도 같은 값으로 확인한다 (content_service.MAX_TAGS). 글자 수는 화면에서만 더 좁게 잡는다
const MAX_TAGS = 5
const MAX_TAG_CHARS = 30

// value: 지금 카테고리 / onChange(name)
export function CategoryPicker({ value, onChange, disabled }) {
  return (
    <div className={styles.cats} role="radiogroup" aria-label="카테고리">
      {CATEGORIES.map((name) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          className={styles.cat}
          onClick={() => onChange(name)}
          disabled={disabled}
        >
          <span className={styles.dot} style={{ background: categoryColor(name) }} />
          {name}
        </button>
      ))}
    </div>
  )
}

// tags: [{ name, is_new }] / onChange(tags) / known: Map(소문자 → 이미 쓰는 태그 이름)
// chipsRef: 저장할 때 태그 칩이 그래프로 날아가는 연출에 쓰는 요소
export function TagEditor({ tags, onChange, known, chipsRef, disabled }) {
  const listId = useId()
  const [draft, setDraft] = useState("")
  const [hint, setHint] = useState(null)
  const full = tags.length >= MAX_TAGS

  function add(raw) {
    const next = [...tags]
    let msg = null
    for (const piece of raw.split(",")) {
      const typed = piece.trim()
      if (!typed) continue
      if (typed.length > MAX_TAG_CHARS) {
        msg = `태그는 ${MAX_TAG_CHARS}자까지 쓸 수 있습니다`
        continue
      }
      const key = typed.toLowerCase()
      if (next.some((t) => t.name.toLowerCase() === key)) {
        msg = "이미 붙어 있는 태그입니다"
        continue
      }
      if (next.length >= MAX_TAGS) {
        msg = `태그는 ${MAX_TAGS}개까지 붙일 수 있습니다`
        break
      }
      // 이미 쓰는 태그와 대소문자만 다르면 그 이름을 쓴다 (같은 태그로 이어지게)
      const name = known.get(key) ?? typed
      next.push({ name, is_new: !known.has(key) })
    }
    setHint(msg)
    setDraft("")
    if (next.length !== tags.length) onChange(next)
  }

  function remove(name) {
    setHint(null)
    onChange(tags.filter((t) => t.name !== name))
  }

  function onKeyDown(e) {
    // 한글 조합 중의 Enter는 글자 확정이라 넘긴다
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      add(draft)
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      remove(tags[tags.length - 1].name)
    }
  }

  return (
    <div className={styles.tagBox}>
      <div className={styles.tags} ref={chipsRef}>
        {tags.map((t) => (
          <span
            key={t.name}
            data-tag={t.name.toLowerCase()}
            className={t.is_new ? `${styles.chip} ${styles.fresh}` : styles.chip}
          >
            {t.name}
            {t.is_new && <span className={styles.freshMark}>새 태그</span>}
            <button
              type="button"
              className={styles.x}
              onClick={() => remove(t.name)}
              disabled={disabled}
              aria-label={`${t.name} 태그 빼기`}
            >
              ×
            </button>
          </span>
        ))}
        {!full && (
          <input
            className={styles.tagInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => draft.trim() && add(draft)}
            list={listId}
            maxLength={MAX_TAG_CHARS + 20}
            disabled={disabled}
            placeholder={tags.length === 0 ? "태그 입력 후 Enter" : "태그 추가"}
            aria-label="태그 추가"
          />
        )}
      </div>
      {/* 이미 쓰는 태그를 고르기 쉽게 (같은 뜻을 다른 글자로 쓰는 일을 줄인다) */}
      <datalist id={listId}>
        {[...known.values()].map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {hint && (
        <span className={styles.hint} role="status">
          {hint}
        </span>
      )}
    </div>
  )
}
