/* global React, SupportIcons */
// Neutral "Fitzrovia Tool" host shell. Used to demonstrate Support widget in-context.
// Renders sidebar + header + content (sample table) + optional footer.

const { Help, Search, Home, Building, Users, Chart, Settings, FileText, External } = SupportIcons;

function HostShell({
  toolName = "Property Operations",
  activeNav = "Units",
  showFooter = true,
  headerSlot = null,        // ReactNode injected into header right side (for trigger button)
  footerSlot = null,        // ReactNode injected into footer (for trigger link)
  children,                 // overlays — drawer, FAB, toast, etc.
  contentOverride = null,   // optional alt content
}) {
  const navItems = [
    { label: "Overview", icon: Home },
    { label: "Properties", icon: Building },
    { label: "Units", icon: FileText },
    { label: "Residents", icon: Users },
    { label: "Reports", icon: Chart },
  ];

  return (
    <div className={"host" + (showFooter ? "" : " host--no-footer")}>
      {/* Sidebar */}
      <aside className="host__sidebar">
        <div className="host__brand">
          <div className="host__brand-mark">F</div>
          <div>
            <div className="host__brand-name">Fitzrovia</div>
            <div className="host__brand-tool">{toolName}</div>
          </div>
        </div>
        <div className="host__nav-group">Main</div>
        {navItems.map(({ label, icon: Ico }) => (
          <div
            key={label}
            className={"host__nav-item" + (label === activeNav ? " is-active" : "")}
          >
            <Ico />
            <span>{label}</span>
          </div>
        ))}
        <div className="host__nav-group">Workspace</div>
        <div className="host__nav-item"><Settings /><span>Settings</span></div>
      </aside>

      {/* Header */}
      <header className="host__header">
        <div className="host__header-title">{activeNav}</div>
        <div className="host__header-spacer" />
        <div className="host__header-search">
          <Search />
          <span>Search…</span>
        </div>
        {headerSlot}
        <div className="host__avatar">KM</div>
      </header>

      {/* Content */}
      <div className="host__content">
        {contentOverride || <SampleTable />}
      </div>

      {/* Footer */}
      {showFooter && (
        <footer className="host__footer">
          <span>Last sync 2 min ago</span>
          <span style={{ flex: 1 }} />
          {footerSlot}
          <span className="host__footer-link"><External />Documentation</span>
          <span>v2.4.1</span>
        </footer>
      )}

      {children}
    </div>
  );
}

function SampleTable() {
  const rows = [
    ["3201", "Elm Ledbury", "1B / 1Bath", "$2,450", "Available"],
    ["3204", "Elm Ledbury", "Studio", "$1,890", "Leased"],
    ["3208", "Elm Ledbury", "2B / 2Bath", "$3,200", "Notice"],
    ["1102", "Sloane",       "1B / 1Bath", "$2,380", "Leased"],
    ["1115", "Sloane",       "2B / 1Bath", "$2,950", "Available"],
    ["0408", "Parker",       "Studio",     "$1,790", "Leased"],
    ["0412", "Parker",       "1B / 1Bath", "$2,290", "Renewal"],
    ["2204", "Waverley",     "2B / 2Bath", "$3,150", "Leased"],
  ];
  const statusColor = (s) => {
    if (s === "Available") return { color: "var(--status-success)", bg: "var(--status-success-soft)" };
    if (s === "Notice")    return { color: "var(--status-warning)", bg: "var(--status-warning-soft)" };
    if (s === "Renewal")   return { color: "var(--status-info)",    bg: "var(--status-info-soft)" };
    return { color: "var(--fg-muted)", bg: "var(--bg-surface-alt)" };
  };
  return (
    <div className="sample-table">
      <div className="sample-table__head">
        <div className="sample-table__title">Active units</div>
        <div className="sample-table__meta">8 of 247 · filtered by status</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: 80 }}>Unit</th>
            <th>Building</th>
            <th>Floorplan</th>
            <th style={{ textAlign: "right" }}>Rent</th>
            <th style={{ width: 120 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const s = statusColor(r[4]);
            return (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{r[0]}</td>
                <td>{r[1]}</td>
                <td>{r[2]}</td>
                <td className="num">{r[3]}</td>
                <td>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: s.bg,
                    color: s.color,
                    fontSize: 12,
                    fontWeight: 500,
                  }}>{r[4]}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

window.HostShell = HostShell;
window.SampleTable = SampleTable;
