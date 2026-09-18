import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  firstHuman,
  waitingCaption,
  waitingFoot,
  waitingItems,
  whatLabel,
  type AttentionDump,
  type WaitingItem,
} from "../lib/attention";
import {
  DEFAULT_REJECT_REASON,
  REJECT_REASONS,
  formatAge,
  humanRowDetail,
  waitingOnWho,
  type RejectReason,
} from "../lib/copy";
import { experimentPath } from "../shell/routes";

type WaitingViewProps = {
  dump: AttentionDump;
  onReload: () => void;
};

export function WaitingView({ dump, onReload }: WaitingViewProps) {
  const navigate = useNavigate();
  const items = waitingItems(dump);
  const [selected, setSelected] = useState(() => Math.max(0, items.findIndex((item) => item.waiting_on === "human")));
  const [sheet, setSheet] = useState<"reject" | null>(null);
  const [rejectReason, setRejectReason] = useState<RejectReason>(DEFAULT_REJECT_REASON);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const next = waitingItems(dump);
    setSelected(Math.max(0, next.findIndex((item) => item.waiting_on === "human")));
    setFeedback(null);
  }, [dump]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (sheet) {
        setSheet(null);
        return;
      }
      const focused = document.activeElement;
      if (focused instanceof HTMLElement) {
        focused.blur();
      }
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [sheet]);

  if (!items.length) {
    return (
      <section className="empty" data-testid="empty-waiting">
        <h1>Nothing waiting</h1>
        <p className="quiet" style={{ margin: "0 0 12px" }}>
          Board is clear. Open an experiment when you want to measure something.
        </p>
        <button
          type="button"
          className="secondary"
          onClick={() => navigate(experimentPath("new"))}
        >
          New experiment
        </button>
      </section>
    );
  }

  const human = firstHuman(items);

  function approve(): void {
    if (!human) {
      return;
    }
    setSheet(null);
    setFeedback("Approved on this row. Persist with rdos steer.gate --actor human.");
  }

  function moveSelection(next: number): void {
    const clamped = Math.max(0, Math.min(items.length - 1, next));
    setSelected(clamped);
    const item = items[clamped];
    if (!item) {
      return;
    }
    const row = document.querySelector<HTMLElement>(`tr[data-id="${CSS.escape(item.id)}"]`);
    row?.focus();
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLTableSectionElement>): void {
    if (event.key === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(selected + 1);
      return;
    }
    if (event.key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(selected - 1);
      return;
    }
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      const row = items[selected];
      if (row && row.waiting_on === "human") {
        setSheet("reject");
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = items[selected];
      if (row && row.waiting_on === "human") {
        approve();
      }
    }
  }

  return (
    <>
      <table>
        <caption>{waitingCaption(items)}</caption>
        <thead>
          <tr>
            <th scope="col">What</th>
            <th scope="col">Waiting on</th>
            <th scope="col" className="num">
              Age
            </th>
          </tr>
        </thead>
        <tbody tabIndex={0} onKeyDown={onKeyDown} data-testid="waiting-body">
          {items.map((item, index) => (
            <WaitingRow
              key={item.id}
              item={item}
              selected={index === selected}
              showActions={human !== null && item.id === human.id}
              feedback={human !== null && item.id === human.id ? feedback : null}
              onSelect={() => setSelected(index)}
              onApprove={approve}
              onReject={() => setSheet("reject")}
              onDetails={() => navigate(experimentPath(item.id))}
            />
          ))}
        </tbody>
      </table>
      <div className="foot">{waitingFoot(dump)}</div>
      {sheet === "reject" ? (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Reject" data-testid="reject-sheet">
          <div className="sheet-card">
            <h1>Reject</h1>
            <label>
              Reason
              <select
                value={rejectReason}
                onChange={(event) => setRejectReason(readRejectReason(event.target.value))}
              >
                {REJECT_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <button
                type="button"
                data-testid="btn-confirm-reject"
                onClick={() => {
                  setSheet(null);
                  setRejectReason(DEFAULT_REJECT_REASON);
                  onReload();
                }}
              >
                Confirm reject
              </button>
              <button type="button" className="secondary" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type WaitingRowProps = {
  item: WaitingItem;
  selected: boolean;
  showActions: boolean;
  feedback: string | null;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDetails: () => void;
};

function WaitingRow({
  item,
  selected,
  showActions,
  feedback,
  onSelect,
  onApprove,
  onReject,
  onDetails,
}: WaitingRowProps) {
  const human = item.waiting_on === "human";
  const quiet = human ? "" : "quiet";
  const testid = testIdFor(item.waiting_on);

  return (
    <tr
      className={`${human ? "human" : ""} ${selected ? "selected" : ""}`.trim()}
      data-id={item.id}
      data-testid={testid}
      tabIndex={0}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) {
          return;
        }
        onSelect();
      }}
    >
      <td className={quiet}>
        {whatLabel(item)}
        {showActions ? (
          <>
            <span className="who">{humanRowDetail()}</span>
            <div className="actions">
              <button type="button" data-testid="btn-approve" onClick={onApprove}>
                Approve
              </button>
              <button type="button" className="secondary" data-testid="btn-reject" onClick={onReject}>
                Reject
              </button>
              <button type="button" className="secondary" onClick={onDetails}>
                Details
              </button>
            </div>
            {feedback ? <p className="row-feedback">{feedback}</p> : null}
          </>
        ) : null}
      </td>
      <td className={quiet}>{waitingOnWho(item.waiting_on)}</td>
      <td className={`num ${quiet}`.trim()}>{formatAge(item.age_s)}</td>
    </tr>
  );
}

function readRejectReason(value: string): RejectReason {
  const found = REJECT_REASONS.find((reason) => reason === value);
  if (found) {
    return found;
  }
  return DEFAULT_REJECT_REASON;
}

function testIdFor(who: WaitingItem["waiting_on"]): string {
  switch (who) {
    case "human":
      return "needs-you";
    case "proof":
      return "proof-waiting";
    case "agent":
      return "agent-waiting";
    default: {
      const neverWho: never = who;
      throw new Error(`unhandled WaitingOn: ${neverWho}`);
    }
  }
}
