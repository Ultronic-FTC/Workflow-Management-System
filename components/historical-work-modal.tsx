"use client";

import styles from "./historical-work-modal.module.css";

export type HistoricalParticipant = {
  name: string;
  hours: number;
  active: boolean;
};

export type HistoricalEventDetail = {
  dateKey: string;
  category: string;
  project: string;
  task: string;
  workType: string | null;
  description: string | null;
  totalHours: number;
  participants: HistoricalParticipant[];
};

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

function formatHours(value: number) {
  return Number.isInteger(value) ? `${value} hrs` : `${value.toFixed(1)} hrs`;
}

export function HistoricalWorkModal({
  event,
  onClose,
}: {
  event: HistoricalEventDetail;
  onClose: () => void;
}) {
  return (
    <div
      className={styles.overlay}
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.currentTarget === mouseEvent.target) {
          onClose();
        }
      }}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="historical-work-title"
      >
        <header className={styles.header}>
          <div>
            <p>HISTORICAL WORK · {event.category}</p>
            <h2 id="historical-work-title">{event.task}</h2>
            <span>
              {event.project} · {formatDate(event.dateKey)}
            </span>
          </div>

          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.metrics}>
            <div>
              <span>Total Team Hours</span>
              <strong>{formatHours(event.totalHours)}</strong>
            </div>
            <div>
              <span>Participants</span>
              <strong>{event.participants.length}</strong>
            </div>
            <div>
              <span>Type</span>
              <strong>{event.workType || "Not specified"}</strong>
            </div>
          </div>

          <section>
            <h3>Description</h3>
            <p>{event.description || "No description recorded."}</p>
          </section>

          <section>
            <h3>Individual Hours</h3>
            <div className={styles.participantList}>
              {event.participants
                .slice()
                .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name))
                .map((participant) => (
                  <div className={styles.participant} key={participant.name}>
                    <div>
                      <strong>{participant.name}</strong>
                      {!participant.active && <span>Historical Member</span>}
                    </div>
                    <b>{formatHours(participant.hours)}</b>
                  </div>
                ))}
            </div>
          </section>

          <footer>
            Historical records are read-only and do not affect the current
            Team Board or project completion percentages.
          </footer>
        </div>
      </section>
    </div>
  );
}
