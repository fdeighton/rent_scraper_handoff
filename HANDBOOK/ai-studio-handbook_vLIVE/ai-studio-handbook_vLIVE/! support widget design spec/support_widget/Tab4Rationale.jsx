/* global React */
// Tab 4 — Rationale document. Argues for the recommendations so the
// stakeholder can defend them when sharing with the team.

function Rationale() {
  return (
    <div className="tab-panel">
      <div className="tab-panel__head">
        <div className="tab-panel__eyebrow">Rationale</div>
        <h1 className="tab-panel__title">Why the Support widget looks like this</h1>
        <p className="tab-panel__lede">
          A short brief you can share or paraphrase. Each section ends with a one-line takeaway.
        </p>
      </div>

      <article className="doc">
        <p className="doc__lede">
          The Support widget is the only component that ships in <em>every</em> Fitzrovia tool. Its patterns will be seen most often by users and reused most often by the build team. Getting it right propagates correctness across the platform; getting it wrong propagates inconsistency. Treat it as template-setting, not utility.
        </p>

        <h2>Decisions at a glance</h2>
        <div className="doc__decisions">
          <table>
            <thead>
              <tr><th>Question</th><th>Decision</th><th>One-line reason</th></tr>
            </thead>
            <tbody>
              <tr><td>Trigger placement</td><td>Labelled “Support” button, header, left of avatar</td><td>No universal icon for help — label earns its keep on discoverability.</td></tr>
              <tr><td>Form container</td><td>Right-side drawer</td><td>Keeps host context visible; reads as "still the same tool".</td></tr>
              <tr><td>Confirmation</td><td>Inline panel + dismiss-toast</td><td>Receipt where they were, reinforcement when they return to task.</td></tr>
              <tr><td>Categories</td><td>Bug · Question · Feature request · Other</td><td>Four routes triage cleanly; more dilutes; fewer asks the user too little.</td></tr>
              <tr><td>Auto-captured metadata</td><td>Compact summary + disclosure</td><td>Honest by default, never in the way.</td></tr>
              <tr><td>Screenshot</td><td>Drop / browse / paste (Cmd+V)</td><td>Paste is the dominant capture habit on Windows for this audience.</td></tr>
            </tbody>
          </table>
        </div>

        <h2>1 — Why a labelled header button, not an icon-only, FAB, or footer link</h2>
        <p>
          Help / support has no universal icon convention — nothing like the bell for notifications or the magnifier for search. The design system’s <em>labelled vs icon-only</em> rule applies cleanly: when an icon doesn’t carry its own meaning, the label earns its keep. So the trigger is a small button reading “Support” with a life-buoy icon to its left, sitting left of the user avatar in every Fitzrovia tool.
        </p>
        <p>
          The styling is deliberately quiet: secondary button weight — navy text on a white surface with a thin border — not the primary orange CTA. Header-mounted utilities are never the dominant action on the screen, and orange in this system is reserved for the action you actually want the user to take (Save, Send, Submit). A loud Support button would compete with whatever the user is there to do.
        </p>
        <p>
          A floating action button looks consumer. Linear, Stripe, Notion, Apple Business Manager, Microsoft 365 — none of them put a circular help-bubble in the corner of every screen. A FAB also imposes itself: every tool has to design around it, every dense table has 48 px of unusable bottom-right corner. That’s a tax we’d pay forever for marginal discoverability.
        </p>
        <p>
          A footer link is the opposite failure: predictable, but invisible. On a portfolio overview or a financial dashboard with one screen of data above the fold, the user never looks down. And the moment a tool ships without a footer (some quick utilities will), the pattern breaks.
        </p>
        <div className="doc__pullquote">
          <strong>Takeaway:</strong> Labelled “Support” button, secondary weight, header-mounted in every Fitzrovia tool. Discoverable by reading, not by hovering.
        </div>

        <h2>2 — Why a drawer, not a modal or a new page</h2>
        <p>
          A modal is a hard interrupt. It says "stop what you were doing, this is now the only thing that matters." But the user is mid-task — they were looking at unit 3208's status, they noticed something wrong, and they want to file the issue and get back to it. The modal makes them context-switch twice; the drawer makes them context-switch zero times.
        </p>
        <p>
          A new page is worse: full navigation cost, history-stack confusion, and the host tool's data disappears entirely. By the time the user finishes filing, they've forgotten what they were doing.
        </p>
        <p>
          The right-side drawer keeps the host tool visible behind a soft scrim, slides in fast, and dismisses with the same gesture. It's also the form factor that scales: a financial dashboard, a leasing pipeline, a one-screen utility — all can host a drawer without redesigning their layout. A modal forces every tool to budget vertical space for one; a drawer just <em>arrives</em>.
        </p>
        <div className="doc__pullquote">
          <strong>Takeaway:</strong> Drawer respects the user's current task. Modal interrupts it. Page abandons it.
        </div>

        <h2>3 — Why both inline confirmation <em>and</em> a toast</h2>
        <p>
          Single-toast confirmation is the standard productivity pattern, and it's right for most actions. But filing a bug or feature request has higher stakes than saving a draft — the user wants <strong>reassurance</strong> that the message is on its way to a real person, plus a reference number to mention later. A toast alone is too ephemeral for that.
        </p>
        <p>
          Inline success inside the drawer gives them the receipt: “Sent to AI Studio · Reference SUP-104382 · We’ll reply by email if needed.” The format — <code>SUP-</code> plus a six-digit number — matches the Supabase <code>support_submissions.id</code> column the team will write against, and avoids collision with Linear’s <code>AIS-</code> ticket prefix. It’s the moment to be slightly more explicit. Then when they dismiss, a toast briefly confirms it as they return to their task — same message, different cadence. The two reinforce each other; neither blocks.
        </p>

        <h2>4 — Why this category list, and why a dropdown at all</h2>
        <p>
          A free-text-only form lands every submission in one bucket. Triage either becomes a tagging job (slow, error-prone) or doesn't happen (the inbox grows until it's ignored). Four categories — Bug, Question, Feature request, Other — split the inbox into the four channels that map to actual AI Studio workflows: investigate, answer, queue, route.
        </p>
        <p>
          Why not more? "Data looks wrong", "Access / permissions", "Performance" all sound useful, but they're refinements of Bug. Eight categories means users hover, hesitate, and pick wrong. Four is the floor where every option is obviously distinct. Any sub-classification belongs in triage, not in the user's hands.
        </p>

        <h2>5 — Why drop-and-paste for screenshots, not auto-capture</h2>
        <p>
          Auto-capturing the host tool with a "Capture this page" button is tempting — it's magical when it works. But it's also the kind of feature that has edge cases (modals, scrolled-out content, third-party iframes) which surface as bug reports against the support widget itself. We'd be expanding the surface area of the most-shipped component to save the user one keystroke.
        </p>
        <p>
          Cmd/Ctrl+V from the clipboard is what every Microsoft 365 user reflexively does after Snipping Tool. Drag-drop covers everyone else. Browse covers the rest. Together that's 100% coverage with zero failure modes we own.
        </p>

        <h2>6 — How errors set the platform pattern</h2>
        <p>
          Every error in this widget follows the three-rule <strong>error contract</strong> documented in the design system README (under “Content fundamentals · Error contract”). It’s reproduced in summary here for reference, but the README is the source of truth — every future Fitzrovia tool inherits the same rules.
        </p>
        <ol>
          <li><strong>Say what to do, not just what went wrong.</strong> See the network banner: “Check your connection and try again. Your draft is saved.”</li>
          <li><strong>Never lose the user’s input.</strong> Drafts persist through network errors, attachment failures, and drawer-close.</li>
          <li><strong>Validate at the earliest moment that’s helpful.</strong> File too big fires on pick; empty description fires on submit attempt, not on focus.</li>
        </ol>

        <h2>Pre-empting the pushback</h2>
        <p><strong>"It's just a support form. Does this really need to set platform-wide patterns?"</strong></p>
        <p>
          Yes, and that's the point. The Support widget is the most-shipped, most-seen component in the entire AI Studio. A user opening their fifth Fitzrovia tool of the week will have already used this widget's patterns four times. If the button styling, the form field treatment, the error contract, the success cadence — if any of those feel off here, they'll feel off everywhere. And every subsequent component the AI Studio team builds will either inherit these patterns (if they're right) or fork from them (if they're not). One inconsistency early becomes ten inconsistencies in six months.
        </p>
        <p>
          Conversely, if the patterns are right: every future tool inherits a coherent visual language for free. "Make a Save button" stops being a design question — it's the same Save button as the Send button on the support widget. "How should the validation error look?" — same as the description error. That's how you ship a platform that feels like one team built it, even when twelve different tools are in flight.
        </p>
        <div className="doc__pullquote">
          <strong>Takeaway:</strong> Build this widget like it's setting the rules. Because it is.
        </div>

        <h2>What this is <em>not</em> trying to do</h2>
        <ul>
          <li>It's not a replacement for the Teams channel — that's where triage happens. The widget is the on-ramp.</li>
          <li>It's not a help centre or knowledge base. If users want docs, the footer link still goes to documentation.</li>
          <li>It's not trying to be clever. The most valuable thing about this widget is that it works exactly the same way in every tool, every time.</li>
        </ul>
      </article>
    </div>
  );
}

window.Rationale = Rationale;
