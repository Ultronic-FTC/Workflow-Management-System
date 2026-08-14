const people = [
  ["Natalie", 5, 4], ["Sophie", 8, 6], ["Ben", 4, 7], ["Alex", 6, 2], ["Jordan", 3, 0], ["Michael", 5, 3], ["Cache", 4, 2]
];

export default function CapacityPage() {
  return <>
    <div className="page-title-row"><div><p className="eyebrow">WEEKLY PLANNING</p><h1>Capacity</h1><p>Plan work against the time each team member can give this week.</p></div><button className="ghost-button">Week of Aug 10 ▾</button></div>
    <div className="metrics-grid compact"><div className="metric cyan"><strong>35 hrs</strong><span>Available</span></div><div className="metric"><strong>24 hrs</strong><span>Assigned</span></div><div className="metric cyan"><strong>11 hrs</strong><span>Remaining</span></div><div className="metric red"><strong>1</strong><span>Over Capacity</span></div></div>
    <section className="capacity-table panel">
      <div className="panel-heading"><h2>Team Workload</h2><button className="ghost-button">Update My Capacity</button></div>
      <div className="capacity-row header"><span>Member</span><span>Available</span><span>Assigned</span><span>Remaining</span><span>Workload</span></div>
      {people.map(([name, available, assigned]) => {
        const remaining = Number(available) - Number(assigned);
        const pct = Math.min(150, Math.round((Number(assigned) / Math.max(1, Number(available))) * 100));
        return <div className="capacity-row" key={name as string}><strong>{name}</strong><span>{available} hrs</span><span>{assigned} hrs</span><span className={remaining < 0 ? "danger-text" : ""}>{remaining} hrs</span><div className={`workload ${remaining < 0 ? "over" : ""}`}><i style={{ width: `${Math.min(100, pct)}%` }} /></div></div>;
      })}
    </section>
  </>;
}
