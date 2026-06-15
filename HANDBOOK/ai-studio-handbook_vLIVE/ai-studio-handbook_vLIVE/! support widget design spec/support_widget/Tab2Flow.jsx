/* global React, HostShell, SupportDrawer, SuccessToast, SupportIcons */
// Tab 2 — Hi-fi flow. Six stages of the canonical happy path, each rendered
// as a host shell + drawer in the appropriate state. The first stage is
// interactive (the user can click through the real flow); the rest are
// statically pinned to a state for review.

const { Help: HelpIco, ArrowLeft, LifeBuoy } = SupportIcons;

const { useState } = React;

/* ---------- Reusable trigger button (header-mounted) ---------- */
function HeaderTrigger({ onClick }) {
  return (
    <button className="trigger-header" onClick={onClick} aria-label="Get help">
      <LifeBuoy />
      Support
    </button>
  );
}

/* ---------- Stage frame ---------- */
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

/* ---------- Stage 1: idle (interactive) ---------- */
function StageIdle() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("form");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("bug");
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const reset = () => {
    setOpen(false);
    setTimeout(() => {
      setView("form");
      setDescription("");
      setCategory("bug");
      setAttachment(null);
      setSubmitting(false);
      setMetaOpen(false);
    }, 300);
  };

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setView("success");
    }, 900);
  };

  return (
    <Stage
      num="01"
      title="Idle — trigger in header"
      caption="The widget is dormant. The labelled Support button sits left of the user avatar in every Fitzrovia tool — quiet secondary weight, not the orange CTA. Click it to open the drawer."
    >
      <HostShell
        headerSlot={<HeaderTrigger onClick={() => setOpen(true)} />}
      >
        <SupportDrawer
          open={open}
          view={view}
          description={description}
          onDescription={setDescription}
          category={category}
          onCategory={setCategory}
          attachment={attachment}
          onPickFile={(file) => {
            // Validate up front
            if (file.size > 5 * 1024 * 1024) {
              setAttachment({ file, error: "File is over 5 MB. Try a smaller image." });
            } else {
              setAttachment({ file, progress: 100 });
            }
          }}
          onRemoveAttachment={() => setAttachment(null)}
          onSubmit={handleSubmit}
          onClose={() => {
            if (view === "success") {
              setShowToast(true);
              setTimeout(() => setShowToast(false), 4000);
            }
            reset();
          }}
          submitting={submitting}
          metaOpen={metaOpen}
          onToggleMeta={() => setMetaOpen(!metaOpen)}
        />
        {showToast && <SuccessToast onClose={() => setShowToast(false)} />}
      </HostShell>
    </Stage>
  );
}

/* ---------- Stage 2: drawer just opened, empty ---------- */
function StageOpen() {
  return (
    <Stage
      num="02"
      title="Drawer opens — empty form"
      caption="Right-side drawer slides in over a soft scrim. Host context stays visible, so the user knows what they're filing against. Default category is Bug — the most common path."
    >
      <HostShell headerSlot={<HeaderTrigger />}>
        <SupportDrawer
          open
          description=""
          category="bug"
          attachment={null}
          metaOpen={false}
          onDescription={() => {}}
          onCategory={() => {}}
          onPickFile={() => {}}
          onRemoveAttachment={() => {}}
          onSubmit={() => {}}
          onToggleMeta={() => {}}
          onClose={() => {}}
        />
      </HostShell>
    </Stage>
  );
}

/* ---------- Stage 3: metadata expanded ---------- */
function StageMetaOpen() {
  return (
    <Stage
      num="03"
      title="Metadata disclosure"
      caption="One click reveals exactly what we're sending alongside the message — tool, page URL, identity, build, timestamp. Honest by default; out of the way until asked for."
    >
      <HostShell headerSlot={<HeaderTrigger />}>
        <SupportDrawer
          open
          description=""
          category="bug"
          attachment={null}
          metaOpen
          onDescription={() => {}}
          onCategory={() => {}}
          onPickFile={() => {}}
          onRemoveAttachment={() => {}}
          onSubmit={() => {}}
          onToggleMeta={() => {}}
          onClose={() => {}}
        />
      </HostShell>
    </Stage>
  );
}

/* ---------- Stage 4: filled in, ready to send ---------- */
function StageFilled() {
  const fakeFile = new File([new ArrayBuffer(184320)], "unit-3208-status.png", { type: "image/png" });
  return (
    <Stage
      num="04"
      title="Filled — ready to send"
      caption="Description, category, screenshot. Send button activates as soon as the description is non-empty. Attachment shows filename, size, and format — no surprises."
    >
      <HostShell headerSlot={<HeaderTrigger />}>
        <SupportDrawer
          open
          description="Unit 3208 shows status 'Notice' but the resident moved out 6 days ago. Expected status to flip to Available on move-out completion. Happens on every Elm Ledbury unit I've checked this morning."
          category="bug"
          attachment={{ file: fakeFile, progress: 100 }}
          metaOpen={false}
          onDescription={() => {}}
          onCategory={() => {}}
          onPickFile={() => {}}
          onRemoveAttachment={() => {}}
          onSubmit={() => {}}
          onToggleMeta={() => {}}
          onClose={() => {}}
        />
      </HostShell>
    </Stage>
  );
}

/* ---------- Stage 5: submitting ---------- */
function StageSubmitting() {
  const fakeFile = new File([new ArrayBuffer(184320)], "unit-3208-status.png", { type: "image/png" });
  return (
    <Stage
      num="05"
      title="Submitting"
      caption="Send button shows an inline spinner; the rest of the form stays interactive in case the user needs to cancel. Optimistic — typically resolves in under a second."
    >
      <HostShell headerSlot={<HeaderTrigger />}>
        <SupportDrawer
          open
          description="Unit 3208 shows status 'Notice' but the resident moved out 6 days ago. Expected status to flip to Available on move-out completion. Happens on every Elm Ledbury unit I've checked this morning."
          category="bug"
          attachment={{ file: fakeFile, progress: 100 }}
          metaOpen={false}
          submitting
          onDescription={() => {}}
          onCategory={() => {}}
          onPickFile={() => {}}
          onRemoveAttachment={() => {}}
          onSubmit={() => {}}
          onToggleMeta={() => {}}
          onClose={() => {}}
        />
      </HostShell>
    </Stage>
  );
}

/* ---------- Stage 6: success → toast ---------- */
function StageSuccess() {
  return (
    <Stage
      num="06"
      title="Confirmation — inline + toast"
      caption="Inline success replaces the form with a clear receipt and reference number. After dismiss, a toast briefly reinforces it as the user returns to their task — both signals, neither blocking."
    >
      <HostShell headerSlot={<HeaderTrigger />}>
        <SupportDrawer
          open
          view="success"
          description=""
          category="bug"
          attachment={null}
          metaOpen={false}
          onDescription={() => {}}
          onCategory={() => {}}
          onPickFile={() => {}}
          onRemoveAttachment={() => {}}
          onSubmit={() => {}}
          onToggleMeta={() => {}}
          onClose={() => {}}
        />
      </HostShell>
    </Stage>
  );
}

function HiFiFlow() {
  return (
    <div className="tab-panel">
      <div className="tab-panel__head">
        <div className="tab-panel__eyebrow">Hi-fi flow · happy path</div>
        <h1 className="tab-panel__title">Trigger → form → confirmation</h1>
        <p className="tab-panel__lede">
          Six stages, all states. The first card is interactive — click the help icon and walk through the full flow yourself. The rest are pinned for review.
        </p>
      </div>
      <div className="stage-grid">
        <StageIdle />
        <StageOpen />
        <StageMetaOpen />
        <StageFilled />
        <StageSubmitting />
        <StageSuccess />
      </div>
    </div>
  );
}

window.HiFiFlow = HiFiFlow;
