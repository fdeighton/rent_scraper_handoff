/* global React, HostShell, SupportIcons */
// Tab 1 — Placement comparison. Shows 4 host shells side-by-side, each
// demonstrating a different trigger placement, with a "wins/costs" note.

const { Help: HelpIco, LifeBuoy, Message: MsgIco } = SupportIcons;

function PlacementComparison() {
  return (
    <div className="tab-panel">
      <div className="tab-panel__head">
        <div className="tab-panel__eyebrow">Decision · trigger placement</div>
        <h1 className="tab-panel__title">Where should the Support trigger live?</h1>
        <p className="tab-panel__lede">
          Same tool, four placements. Compare how each reads in context, then see the rationale on the next tab.
          Recommendation: <b style={{ color: "var(--fg-primary)" }}>labelled header button</b> — "Support" is not a universal icon convention, so the label earns its keep on discoverability.
        </p>
      </div>

      <div className="placement-grid">
        <PlacementCard
          title="Labelled header button"
          verdict="Recommended"
          rec
          gains={["Self-explanatory — no hover-to-discover", "Quiet visual weight (secondary, not orange)", "Conventional header position", "Scales to any tool"]}
          costs={["Slightly more header real estate than icon-only", "One more string to localise later"]}
        >
          <HostShell
            toolName="Property Operations"
            activeNav="Units"
            headerSlot={
              <button className="trigger-header" aria-label="Get help">
                <LifeBuoy />
                Support
              </button>
            }
          />
        </PlacementCard>

        <PlacementCard
          title="Header icon-only"
          verdict="Considered"
          gains={["Smallest footprint", "Visually clean"]}
          costs={["No universal icon for help/support — fails the icon-only rule", "Discoverable only on hover", "Rejected per design system §Labelled vs icon-only"]}
        >
          <HostShell
            toolName="Property Operations"
            activeNav="Units"
            headerSlot={
              <button className="trigger-header" aria-label="Get help" style={{ padding: "0 8px" }}>
                <LifeBuoy />
              </button>
            }
          />
        </PlacementCard>

        <PlacementCard
          title="Footer link"
          gains={["Predictable consistency", "Out of the way", "Pairs naturally with version + docs"]}
          costs={["Below the fold on data-heavy tools", "Users in flow rarely look down", "Inconsistent if a tool ships without footer"]}
        >
          <HostShell
            toolName="Property Operations"
            activeNav="Units"
            footerSlot={
              <span className="host__footer-link">
                <HelpIco />
                Get help
              </span>
            }
          />
        </PlacementCard>

        <PlacementCard
          title="Floating action button (FAB)"
          gains={["Maximum discoverability", "Anchored to viewport, not layout"]}
          costs={["Visual weight on every screen", "Covers content (tables, charts)", "Reads consumer/marketing, not institutional", "Forces every tool to design around it"]}
        >
          <HostShell
            toolName="Property Operations"
            activeNav="Units"
          >
            <button className="trigger-fab" aria-label="Get help">
              <LifeBuoy />
            </button>
          </HostShell>
        </PlacementCard>

        <PlacementCard
          title="Corner ⓘ icon"
          gains={["Tiny footprint", "Doesn't distract"]}
          costs={["Borderline invisible — fails discoverability", "Ambiguous (info? help? settings?)", "Easy to miss in dense tools"]}
        >
          <HostShell
            toolName="Property Operations"
            activeNav="Units"
          >
            <button className="trigger-corner" aria-label="Get help">
              <HelpIco />
            </button>
          </HostShell>
        </PlacementCard>
      </div>
    </div>
  );
}

function PlacementCard({ title, verdict, rec, gains, costs, children }) {
  return (
    <div className="placement-card">
      <div className="placement-card__head">
        <div className="placement-card__title">{title}</div>
        {verdict && (
          <span className={"placement-card__verdict " + (rec ? "placement-card__verdict--rec" : "placement-card__verdict--alt")}>
            {verdict}
          </span>
        )}
      </div>
      {children}
      <div className="placement-card__notes">
        <div className="placement-card__note placement-card__note--gain">
          <div className="placement-card__note-head">Wins</div>
          <ul>{gains.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </div>
        <div className="placement-card__note placement-card__note--cost">
          <div className="placement-card__note-head">Costs</div>
          <ul>{costs.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}

window.PlacementComparison = PlacementComparison;
