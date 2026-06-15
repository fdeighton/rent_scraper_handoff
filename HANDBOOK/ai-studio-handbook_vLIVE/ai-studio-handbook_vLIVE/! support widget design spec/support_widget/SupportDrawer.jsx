/* global React, SupportIcons */
// SupportDrawer — the canonical right-side drawer that opens when a Support
// trigger is clicked. Pure presentational: takes `state` + handlers, renders
// the right view. State machine: idle → submitting → success | error.

const { X, Info, ChevronDown, Upload, Image, Check, AlertCircle,
        WifiOff, Refresh, Bug, Help, Lightbulb, Clipboard } = SupportIcons;

const CATEGORIES = [
  { value: "bug",     label: "Bug",              icon: Bug },
  { value: "question",label: "Question",         icon: Help },
  { value: "feature", label: "Feature request",  icon: Lightbulb },
  { value: "other",   label: "Other",            icon: Clipboard },
];

const META = {
  tool: "Property Operations",
  url: "hub.fitzrovia.ca/property-ops/units?status=active",
  user: "karim.mourad@fitzrovia.ca",
  build: "v2.4.1 (a1f3c2d)",
};

function MetaDisclosure({ open, onToggle, meta = META }) {
  return (
    <div className={"meta-disclosure" + (open ? " is-open" : "")}>
      <div className="meta-disclosure__row" onClick={onToggle}>
        <Info className="meta-disclosure__icon" />
        <div className="meta-disclosure__summary">
          From <b>{meta.tool}</b> · {meta.user.split("@")[0]}@…
        </div>
        <ChevronDown className="meta-disclosure__chevron" />
      </div>
      <dl className="meta-disclosure__details">
        <dt>Tool</dt><dd>{meta.tool}</dd>
        <dt>Page</dt><dd style={{ wordBreak: "break-all" }}>{meta.url}</dd>
        <dt>User</dt><dd>{meta.user}</dd>
        <dt>Build</dt><dd>{meta.build}</dd>
        <dt>Time</dt><dd>{new Date().toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}</dd>
      </dl>
    </div>
  );
}

function CategoryRow({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Category" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {CATEGORIES.map(({ value: v, label, icon: Ico }) => (
        <label
          key={v}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            border: "1px solid",
            borderColor: value === v ? "var(--fz-orange)" : "var(--border-default)",
            background: value === v ? "var(--bg-accent-soft)" : "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            fontSize: "var(--fs-label)",
            fontWeight: 500,
            color: value === v ? "var(--fz-navy)" : "var(--fg-secondary)",
            transition: "all var(--dur-fast) var(--ease-standard)",
          }}
        >
          <input
            type="radio"
            name="cat"
            checked={value === v}
            onChange={() => onChange(v)}
            style={{ display: "none" }}
          />
          <Ico size={14} style={{ color: value === v ? "var(--fz-orange)" : "var(--fg-muted)" }} />
          {label}
        </label>
      ))}
    </div>
  );
}

function Attachment({ file, error, onRemove, progress }) {
  return (
    <div className={"attachment" + (error ? " is-error" : "")}>
      <div className="attachment__thumb"><Image /></div>
      <div className="attachment__main">
        <div className="attachment__name">{file.name}</div>
        <div className="attachment__meta">
          {error
            ? <span style={{ color: "var(--fz-orange-600)", fontWeight: 500 }}>{error}</span>
            : `${(file.size / 1024).toFixed(0)} KB · ${file.type.replace("image/", "").toUpperCase()}`}
        </div>
        {progress != null && progress < 100 && !error && (
          <div className="progress"><div className="progress__fill" style={{ width: `${progress}%` }} /></div>
        )}
      </div>
      <button className="attachment__remove" onClick={onRemove} aria-label="Remove attachment"><X /></button>
    </div>
  );
}

/**
 * Drawer shell — renders one of:
 *  - "form"         : main form
 *  - "submitting"   : form with disabled + spinner CTA (caller swaps)
 *  - "success"      : inline confirmation
 *  - "error-network": form + dismissable network banner
 * Errors at the field/attachment level are rendered inside the form.
 */
function SupportDrawer({
  open,
  view = "form",                       // "form" | "success"
  description,
  onDescription,
  category,
  onCategory,
  attachment,                          // { file, error, progress } | null
  onPickFile,
  onRemoveAttachment,
  onSubmit,
  onClose,
  submitting = false,
  networkError = false,
  metaOpen,
  onToggleMeta,
  validationErrors = {},               // { description?: string }
  onDismissNetworkError,
}) {
  const charCount = description.length;
  const SOFT_LIMIT = 500;
  const counterClass = "char-counter" +
    (charCount > SOFT_LIMIT ? " is-over" : charCount > SOFT_LIMIT * 0.9 ? " is-near" : "");

  return (
    <>
      <div className={"drawer-scrim" + (open ? " is-open" : "")} onClick={onClose} />
      <aside className={"drawer" + (open ? " is-open" : "")} role="dialog" aria-label="Get help">
        {view === "success" ? (
          <SuccessPanel onClose={onClose} />
        ) : (
          <>
            <div className="drawer__head">
              <div>
                <div className="drawer__title">Get help</div>
                <div className="drawer__subtitle">Reaches the AI Studio team in Teams.</div>
              </div>
              <button className="btn btn--icon" onClick={onClose} aria-label="Close"><X /></button>
            </div>

            <form className="drawer__body" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
              {networkError && (
                <div className="banner banner--danger">
                  <WifiOff className="banner__icon" />
                  <div className="banner__main">
                    <div className="banner__title">Couldn't send your message</div>
                    <div className="banner__body">Check your connection and try again. Your draft is saved.</div>
                    <div className="banner__actions">
                      <button type="button" className="btn btn--small btn--secondary" onClick={onSubmit}>
                        <Refresh /> Retry
                      </button>
                      <button type="button" className="btn btn--small btn--ghost" onClick={onDismissNetworkError}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <MetaDisclosure open={metaOpen} onToggle={onToggleMeta} />

              <div className="field">
                <div className="field__label-row">
                  <label className="field__label" htmlFor="sw-cat">Category</label>
                  <span className="field__label-aux">Helps us route faster</span>
                </div>
                <CategoryRow value={category} onChange={onCategory} />
              </div>

              <div className="field">
                <div className="field__label-row">
                  <label className="field__label" htmlFor="sw-desc">What's going on?</label>
                  <span className={counterClass}>{charCount} / {SOFT_LIMIT}</span>
                </div>
                <textarea
                  id="sw-desc"
                  className={"textarea" + (validationErrors.description ? " is-error" : "")}
                  placeholder={"What were you doing, what did you see, and what did you expect? If a number or status looks wrong, include the unit, building, or report so we can find it. Specifics get faster fixes \u2014 e.g. \u201cUnit 3208 at Elm Ledbury still shows Notice; resident moved out 6 days ago.\u201d"}
                  value={description}
                  onChange={(e) => onDescription(e.target.value)}
                />
                {validationErrors.description && (
                  <div className="field__error"><AlertCircle /> {validationErrors.description}</div>
                )}
              </div>

              <div className="field">
                <div className="field__label-row">
                  <label className="field__label">Screenshot</label>
                  <span className="field__label-aux">Optional · paste or upload</span>
                </div>
                {attachment ? (
                  <Attachment
                    file={attachment.file}
                    error={attachment.error}
                    progress={attachment.progress}
                    onRemove={onRemoveAttachment}
                  />
                ) : (
                  <label className="dropzone">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: "none" }}
                      onChange={(e) => e.target.files[0] && onPickFile(e.target.files[0])}
                    />
                    <Upload className="dropzone__icon" />
                    <div className="dropzone__main">Drop, click to browse, or paste (Cmd+V)</div>
                    <div className="dropzone__hint">PNG, JPG, or WebP · up to 5 MB</div>
                  </label>
                )}
              </div>
            </form>

            <div className="drawer__foot">
              <span className="caption" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Info size={12} style={{ color: "var(--fg-muted)" }}/>
                Goes to AI Studio · usually within a business day
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn--secondary" onClick={onClose}>Cancel</button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={onSubmit}
                  disabled={submitting || !description.trim()}
                >
                  {submitting ? <><span className="spinner" /> Sending…</> : "Send"}
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function SuccessPanel({ onClose }) {
  // SUP-XXXXXX — 6 digits, matches the Supabase support_submissions.id format.
  const ref = "SUP-" + String(Math.floor(100000 + Math.random() * 900000));
  return (
    <>
      <div className="drawer__head">
        <div>
          <div className="drawer__title">Thanks for the message</div>
        </div>
        <button className="btn btn--icon" onClick={onClose} aria-label="Close"><X /></button>
      </div>
      <div className="success-panel">
        <div className="success-panel__check"><Check /></div>
        <div className="success-panel__title">Sent to AI Studio</div>
        <div className="success-panel__body">
          We've posted it to the team in Teams. Someone will reply by email if there's a question or once it's resolved.
        </div>
        <div className="success-panel__ref">Reference {ref}</div>
        <button className="btn btn--primary" onClick={onClose} style={{ marginTop: 8 }}>
          Back to Property Operations
        </button>
      </div>
    </>
  );
}

function SuccessToast({ onClose }) {
  return (
    <div className="toast" role="status">
      <Check className="toast__icon" />
      <div className="toast__main">
        <div className="toast__title">Message sent to AI Studio</div>
        <div className="toast__detail">We'll reply by email if needed.</div>
      </div>
      <button className="toast__close" onClick={onClose} aria-label="Dismiss"><X /></button>
    </div>
  );
}

window.SupportDrawer = SupportDrawer;
window.SuccessToast = SuccessToast;
window.CATEGORIES = CATEGORIES;
window.META = META;
