/**
 * QuestionPost.tsx
 * ------------------------------------------------------------------
 * The "Question"-specific field(s) of the New Post form: just a
 * single free-text description textarea. Rendered by Post.tsx when
 * postType === 'question'. Fully controlled - all state lives in the
 * parent (Post.tsx) and is passed down via props.
 * ------------------------------------------------------------------
 */
type Props = {
  description: string
  setDescription: (value: string) => void
  error?: string
}

function QuestionPost({ description, setDescription, error }: Readonly<Props>) {
  return (
    <div className="form-field">
      <label htmlFor="question-description">
        Describe your problem
      </label>
      <textarea
        id="question-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={8}
        placeholder="Provide a detailed description of your question or problem."
        className="form-control"
      />
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

export default QuestionPost