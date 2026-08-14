const projects = [
  ["Intake", "Technical", 68, "16 tasks", "2 blocked", "Aug 24"],
  ["Autonomous", "Technical", 54, "12 tasks", "1 blocked", "Sep 2"],
  ["Drive Practice", "Technical", 40, "8 tasks", "0 blocked", "Sep 5"],
  ["STEM Tent", "Operational", 76, "10 tasks", "0 blocked", "Aug 16"],
  ["RoboRumble", "Operational", 62, "14 tasks", "2 need people", "Sep 12"],
  ["Portfolio", "Operational", 35, "18 tasks", "3 need review", "Oct 1"],
  ["Fundraising", "Operational", 48, "22 tasks", "4 need people", "Sep 30"],
  ["Website", "Operational", 81, "9 tasks", "0 blocked", "Aug 30"],
];

export default function ProjectsPage() {
  return <>
    <div className="page-title-row"><div><p className="eyebrow">WORKSTREAMS</p><h1>Projects</h1><p>Major bodies of work across technical and operational teams.</p></div><button className="primary-button">+ New Project</button></div>
    <div className="project-filters"><button>All Projects</button><button>Technical</button><button>Operational</button><span></span><button>Sort: Target Date ▾</button></div>
    <div className="project-grid">
      {projects.map(([name, type, progress, tasks, risk, target]) => <article className={`project-card ${type === "Technical" ? "technical" : "operational"}`} key={name as string}>
        <div className="project-top"><span>{type}</span><strong>{progress}%</strong></div>
        <h2>{name}</h2>
        <div className="progress"><i style={{ width: `${progress}%` }} /></div>
        <div className="project-stats"><span>{tasks}</span><span>{risk}</span></div>
        <footer>Target: {target}</footer>
      </article>)}
    </div>
  </>;
}
