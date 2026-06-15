/* global React, HostShell, SupportDrawer, SupportIcons */
// Tab 3 — Error states. Four canonical errors, each in-context with the
// drawer open. Recovery copy pre-empts the "what do I do?" question.

const { Help: HelpIco, LifeBuoy } = SupportIcons;

function HeaderTrigger() {
  return (
    <button className="trigger-header" aria-label="Get help">
      <LifeBuoy />
      Support
    </button>
  );
}

function Stage({ num, title, caption, children }) {
  return (
    <div className="stage">
      <div className="stage__head">
        <span className="stage__num">{num}</span>
        <span className="stage__title">{title}</span>
      </div>
      {caption && <p className="stage__caption">{caption}</p>}
      {children}
    </div>
  );
}

const noop = () => {};

/* ---------- A: validation error — empty description on submit attempt ---------- */
function ErrValidation() {
  return (
    <Stage
      num="A"
      title="Validation — empty description"
      caption="Send is disabled until the user types something. If they tab past or paste-then-clear, the inline error fires under the field. Friendly, not scolding — explains what to add, not what they did wrong."
    >
      <HostShell headerSlot={<HeaderTrigger />}>
        <SupportDrawer
          open
          description=""
          category="bug"
          attachment={null}
          metaOpen={false}
          validationErrors={{ description: "Add a short description so we know what to look at." }}
          onDescription={noop} onCategory={noop} onPickFile={noop}
          onRemoveAttachment={noop} onSubmit={noop} onToggleMeta={noop} onClose={noop}
        />
      </HostShell>
    </Stage>
  );
}

/* ---------- B: attachment too large ---------- */
function ErrAttachment() {
  const bigFile = new File([new ArrayBuffer(1024)], "screen-recording-final-v2.png", { type: "image/png" });
  Object.defineProperty(bigFile, "size", { value: 7_843_210 });

  return (
    <Stage
      num="B"
      title="Attachment too large"
      caption="Validation fires the moment the file is selected — not after submit. The attachment row turns red, explains the limit, and the user just clicks × to try a different file."
    >
      <HostShell headerSlot={<HeaderTrigger />}>
        <SupportDrawer
          open
          description="The dashboard freezes when I open the Sloane portfolio filter."
          category="bug"
          attachment={{ file: bigFile, error: "File is 7.8 MB — over the 5 MB limit. Crop or resize and try again." }}
          metaOpen={false}
          onDescription={noop} onCategory={noop} onPickFile={noop}
          onRemoveAttachment={noop} onSubmit={noop} onToggleMeta={noop} onClose={noop}
        />
      </HostShell>
    </Stage>
  );
}

/* ---------- C: upload failed mid-flight ---------- */
function ErrUpload() {
  const file = new File([new ArrayBuffer(184320)], "unit-3208-status.png", { type: "image/png" });
  return (
    <Stage
      num="C"
      title="Attachment upload failed"
      caption="Network blip during the file upload. The attachment shows the failure inline; the user can remove it and re-attach, or send the message without it. The send button stays usable — text alone is still useful."
    >
      <HostShell headerSlot={<HeaderTrigger />}>
        <SupportDrawer
          open
          description="The dashboard freezes when I open the Sloane portfolio filter."
          category="bug"
          attachment={{ file, error: "Couldn't upload — try again, or send without the screenshot." }}
          metaOpen={false}
          onDescription={noop} onCategory={noop} onPickFile={noop}
          onRemoveAttachment={noop} onSubmit={noop} onToggleMeta={noop} onClose={noop}
        />
      </HostShell>
    </Stage>
  );
}

/* ---------- D: network failure on submit ---------- */
function ErrNetwork() {
  const file = new File([new ArrayBuffer(184320)], "unit-3208-status.png", { type: "image/png" });
  return (
    <Stage
      num="D"
      title="Network — couldn't submit"
      caption="Inline banner above the form, not a modal-on-modal. Draft is preserved (state stays in the drawer). One-click Retry; Dismiss closes the banner without losing the message."
    >
      <HostShell headerSlot={<HeaderTrigger />}>
        <SupportDrawer
          open
          description="Unit 3208 shows status 'Notice' but the resident moved out 6 days ago. Expected status to flip to Available on move-out completion."
          category="bug"
          attachment={{ file, progress: 100 }}
          metaOpen={false}
          networkError
          onDescription={noop} onCategory={noop} onPickFile={noop}
          onRemoveAttachment={noop} onSubmit={noop} onToggleMeta={noop} onClose={noop}
          onDismissNetworkError={noop}
        />
      </HostShell>
    </Stage>
  );
}

function ErrorStates() {
  return (
    <div className="tab-panel">
      <div className="tab-panel__head">
        <div className="tab-panel__eyebrow">Errors · canonical patterns</div>
        <h1 className="tab-panel__title">Four states the user might land on</h1>
        <p className="tab-panel__lede">
          Errors say what to do, not just what went wrong. Drafts are never lost. Recovery is one click away.
          These patterns are the platform-wide blueprint for any future Fitzrovia tool.
        </p>
      </div>
      <div className="stage-grid">
        <ErrValidation />
        <ErrAttachment />
        <ErrUpload />
        <ErrNetwork />
      </div>
    </div>
  );
}

window.ErrorStates = ErrorStates;
