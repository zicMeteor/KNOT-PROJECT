// 저장한 자료 고치기: 제목, 카테고리, 태그, 메모
// 다시 분석한 결과로 열면 AI가 제안한 요약·카테고리·태그가 채워져 있고, 저장을 눌러야 바뀐다
import { useEffect, useState } from "react"
import { CategoryPicker, TagEditor } from "../add/EditFields"
import Button from "../ui/Button"
import styles from "./ContentEditForm.module.css"

const MEMO_MAX = 2000

// initial: { title, category, tags: [{ name, is_new }], memo, summary?, analysisStatus? }
// ai: 다시 분석한 결과로 열었는지 / requireMemo: AI 요약이 없는 자료라 제목·메모가 필수인지
// known: 이미 쓰는 태그 / onSave(fields): Promise / onCancel()
// onDirtyChange(bool): 저장하지 않은 내용이 있는지 (서랍을 닫기 전에 물어보려고)
function tagsKey(tags) {
  return tags.map((t) => t.name.toLowerCase()).join("\n")
}

function ContentEditForm({ initial, ai, requireMemo, known, onSave, onCancel, onDirtyChange }) {
  const [title, setTitle] = useState(initial.title ?? "")
  const [category, setCategory] = useState(initial.category)
  const [tags, setTags] = useState(initial.tags)
  const [memo, setMemo] = useState(initial.memo ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const missing = requireMemo && (!title.trim() || !memo.trim())
  // AI로 다시 분석한 결과는 AI 사용 횟수를 쓴 것이라, 고치지 않았어도 저장하지 않은 내용으로 본다
  const dirty =
    ai ||
    title !== (initial.title ?? "") ||
    category !== initial.category ||
    memo !== (initial.memo ?? "") ||
    tagsKey(tags) !== tagsKey(initial.tags)

  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])

  async function submit(e) {
    e.preventDefault()
    if (missing) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        title: title.trim(),
        category,
        tags,
        memo: memo.trim(),
        summary: initial.summary,
        analysisStatus: initial.analysisStatus,
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <h2 className={styles.heading}>{ai ? "AI 분석 결과 확인" : "자료 고치기"}</h2>
      {ai && (
        <>
          <p className={styles.note}>AI가 제안한 값입니다. 고친 뒤 저장을 눌러야 바뀝니다.</p>
          {initial.summary && <p className={styles.summary}>{initial.summary}</p>}
        </>
      )}

      <label className={styles.label} htmlFor="edit-title">
        제목{requireMemo ? "" : " (선택)"}
      </label>
      <input
        id="edit-title"
        className={styles.field}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={saving}
        maxLength={200}
        required={requireMemo}
      />

      <span className={styles.label}>카테고리</span>
      <CategoryPicker value={category} onChange={setCategory} disabled={saving} />

      <span className={styles.label}>태그</span>
      <TagEditor tags={tags} onChange={setTags} known={known} disabled={saving} />

      <label className={styles.label} htmlFor="edit-memo">
        메모{requireMemo ? " (필수)" : " (선택)"}
      </label>
      <textarea
        id="edit-memo"
        className={styles.textarea}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        disabled={saving}
        rows={4}
        maxLength={MEMO_MAX}
        required={requireMemo}
        placeholder="무슨 자료인지, 왜 저장하는지"
      />

      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={saving || missing}>
          {saving ? "저장 중…" : "저장"}
        </Button>
        <Button onClick={onCancel} disabled={saving}>
          취소
        </Button>
      </div>
    </form>
  )
}

export default ContentEditForm
