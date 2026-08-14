const ideas = [
  ["Try silicone tubing for intake rollers", "Design", "Intake", "Sophie"],
  ["Create a scouting heat map tool", "Strategy + Business", "Scouting", "Natalie"],
  ["New STEM Tent spectroscopy station", "Community Outreach", "STEM Tent", "Michael"],
];

const decisions = [
  ["Intake Roller Material", "Intake", "Aug 17", "Open"],
  ["Pit Display Layout", "Branding", "Aug 23", "Due Soon"],
  ["Scouting Data Platform", "Scouting", "Aug 25", "Open"],
];

export default function IdeasDecisionsPage() {
  return <>
    <div className="page-title-row"><div><p className="eyebrow">THINK BEFORE WE BUILD</p><h1>Ideas & Decisions</h1><p>Capture possibilities without cluttering the working board, and preserve important decisions.</p></div><div className="button-row"><button className="ghost-button">+ Add Idea</button><button className="primary-button">+ New Decision</button></div></div>
    <div className="two-column">
      <section className="panel"><div className="panel-heading"><h2>Ideas</h2><span className="count">{ideas.length}</span></div>{ideas.map(([title, category, project, owner]) => <article className="idea-card" key={title}><small>{category} · {project}</small><h3>{title}</h3><p>Submitted by {owner}</p><div><button>Convert to Task</button><button>Archive</button></div></article>)}</section>
      <section className="panel"><div className="panel-heading"><h2>Decisions Needed</h2><span className="count">{decisions.length}</span></div>{decisions.map(([title, project, due, status]) => <article className="decision-card" key={title}><div><small>{project}</small><h3>{title}</h3></div><div><span className="status-pill">{status}</span><small>Due {due}</small></div></article>)}</section>
    </div>
  </>;
}
