import { Metric, TaskCard } from "@/components/ui";

const columns = [
  { name: "Backlog", cards: [
    { title: "Scouting heat-map idea", category: "Strategy + Business", project: "Scouting", tone: "operational" as const, lead: "Natalie", estimate: "2 hrs" },
    { title: "Prototype alternate roller", category: "Design", project: "Intake", tone: "technical" as const, lead: "Sophie", estimate: "3 hrs" },
  ]},
  { name: "Needs Assignment", cards: [
    { title: "Prepare STEM Tent", category: "Community Outreach", project: "STEM Tent", tone: "operational" as const, people: "1 / 3", estimate: "2 hrs", due: "Aug 16", badge: "2 PEOPLE NEEDED" },
  ]},
  { name: "Assigned", cards: [
    { title: "Auto path tuning", category: "Programming", project: "Autonomous", tone: "technical" as const, lead: "Ben", people: "2 / 2", estimate: "4 hrs", due: "Aug 15" },
  ]},
  { name: "In Progress", cards: [
    { title: "Redesign Intake Rollers", category: "Design", project: "Intake", tone: "technical" as const, lead: "Natalie", people: "2 / 3", estimate: "2 hrs", due: "Aug 17", badge: "1 PERSON NEEDED" },
    { title: "Portfolio structure", category: "Strategy + Business", project: "Portfolio", tone: "operational" as const, lead: "Sophie", people: "2 / 2", estimate: "3 hrs", due: "Aug 18" },
  ]},
  { name: "Blocked", cards: [
    { title: "Test intake compression", category: "Build", project: "Intake", tone: "technical" as const, lead: "Michael", people: "2 / 2", estimate: "2 hrs", due: "Aug 14", badge: "BLOCKED" },
  ]},
  { name: "Ready for Review", cards: [
    { title: "Sponsor follow-up template", category: "Professional Outreach", project: "Fundraising", tone: "operational" as const, lead: "Natalie", people: "1 / 1", estimate: "1 hr", due: "Aug 13", badge: "REVIEW" },
  ]},
];

export default function TeamBoardPage() {
  return (
    <>
      <div className="page-title-row"><div><p className="eyebrow">TEAM OPERATIONS</p><h1>Team Board</h1><p>Everything the team is working on, in one place.</p></div><button className="primary-button">+ New Task</button></div>
      <section className="metrics-grid">
        <Metric value="3" label="Overdue" tone="red" />
        <Metric value="4" label="Blocked" tone="red" />
        <Metric value="7" label="Need People" tone="yellow" />
        <Metric value="8" label="Need Review" tone="cyan" />
        <div className="capacity-card"><div><small>TEAM CAPACITY · THIS WEEK</small><strong>42 hrs</strong><span>available</span></div><div><strong>31 hrs</strong><span>committed</span></div><div><strong>11 hrs</strong><span>remaining</span></div></div>
      </section>
      <section className="filterbar"><button>Category ▾</button><button>Project ▾</button><button>Person ▾</button><button>Priority ▾</button><button>Deadline ▾</button><button>My Tasks</button><button>Needs People</button><button>Overdue</button><button>Blocked</button></section>
      <section className="kanban">
        {columns.map((column) => (
          <div className="kanban-column" key={column.name}>
            <div className="column-title"><h2>{column.name}</h2><span>{column.cards.length}</span></div>
            {column.cards.map((card) => <TaskCard key={card.title} {...card} />)}
            <button className="add-task">+ Add task</button>
          </div>
        ))}
      </section>
    </>
  );
}
