import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Inbox as InboxIcon,
  MessageSquare,
  MessageCircle,
  Trash2,
  X,
  Loader2,
  Pencil,
  Check,
} from "lucide-react";
import {
  createInbox,
  deleteInbox,
  fetchAdminInboxes,
  fetchAdminUsers,
  updateInboxAssignments,
  updateInboxSettings,
  type AdminInbox,
  type AdminUser,
} from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Admin "Inboxes" table. Real table layout with bulk select + bulk
 * actions, inline display-name editing, mode toggle per row, and a
 * collapsible member-assignment popover per row.
 */
export default function AdminInboxTable() {
  const [inboxes, setInboxes] = useState<AdminInbox[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [memberPopover, setMemberPopover] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAdminInboxes(), fetchAdminUsers()])
      .then(([i, u]) => {
        setInboxes(i);
        setUsers(u);
      })
      .finally(() => setLoading(false));
  }, []);

  const members = useMemo(
    () => users.filter((u) => u.role !== "admin"),
    [users],
  );

  const allSelected =
    inboxes.length > 0 && inboxes.every((i) => selected.has(i.email));

  function toggleSelected(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(inboxes.map((i) => i.email)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createInbox({
        email,
        displayName: newDisplayName.trim() || null,
      });
      setInboxes((prev) =>
        prev.some((r) => r.email === created.email)
          ? prev.map((r) =>
              r.email === created.email
                ? {
                    ...r,
                    displayName: created.displayName,
                    displayMode: created.displayMode,
                  }
                : r,
            )
          : [...prev, created].sort((a, b) => a.email.localeCompare(b.email)),
      );
      setNewEmail("");
      setNewDisplayName("");
      setCreateOpen(false);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create inbox",
      );
    } finally {
      setCreating(false);
    }
  }

  async function commitName(inbox: AdminInbox, value: string) {
    const next = value.trim() === "" ? null : value.trim();
    if (next === inbox.displayName) {
      setEditingName(null);
      return;
    }
    const res = await updateInboxSettings(inbox.email, { displayName: next });
    setInboxes((prev) =>
      prev.map((r) =>
        r.email === inbox.email
          ? { ...r, displayName: res.displayName, displayMode: res.displayMode }
          : r,
      ),
    );
    setEditingName(null);
  }

  async function handleSetMode(inbox: AdminInbox, next: "thread" | "chat") {
    if (inbox.displayMode === next) return;
    const before = inbox.displayMode;
    setInboxes((all) =>
      all.map((r) =>
        r.email === inbox.email ? { ...r, displayMode: next } : r,
      ),
    );
    try {
      const res = await updateInboxSettings(inbox.email, { displayMode: next });
      setInboxes((all) =>
        all.map((r) =>
          r.email === inbox.email ? { ...r, displayMode: res.displayMode } : r,
        ),
      );
    } catch (err) {
      setInboxes((all) =>
        all.map((r) =>
          r.email === inbox.email ? { ...r, displayMode: before } : r,
        ),
      );
      console.error("Failed to update inbox mode", err);
    }
  }

  async function handleToggleAssignment(inbox: AdminInbox, userId: string) {
    const has = inbox.assignedUserIds.includes(userId);
    const nextIds = has
      ? inbox.assignedUserIds.filter((x) => x !== userId)
      : [...inbox.assignedUserIds, userId];
    const res = await updateInboxAssignments(inbox.email, nextIds);
    setInboxes((prev) =>
      prev.map((r) =>
        r.email === inbox.email
          ? { ...r, assignedUserIds: res.assignedUserIds }
          : r,
      ),
    );
  }

  async function handleDelete(emails: string[]) {
    const label =
      emails.length === 1
        ? `Delete inbox "${emails[0]}"?`
        : `Delete ${emails.length} inboxes?`;
    if (!window.confirm(`${label} This cannot be undone.`)) return;
    setBulkBusy(true);
    try {
      await Promise.all(emails.map((email) => deleteInbox(email)));
      setInboxes((prev) => prev.filter((r) => !emails.includes(r.email)));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const e of emails) next.delete(e);
        return next;
      });
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkSetMode(mode: "thread" | "chat") {
    const targets = inboxes.filter(
      (i) => selected.has(i.email) && i.displayMode !== mode,
    );
    if (targets.length === 0) return;
    setBulkBusy(true);
    setInboxes((all) =>
      all.map((r) => (selected.has(r.email) ? { ...r, displayMode: mode } : r)),
    );
    try {
      await Promise.all(
        targets.map((t) => updateInboxSettings(t.email, { displayMode: mode })),
      );
    } finally {
      setBulkBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm font-light text-text-tertiary">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {/* Top bar — Create button + (when armed) bulk action bar */}
      <div className="flex flex-wrap items-center gap-2">
        {selected.size === 0 ? (
          <button
            onClick={() => setCreateOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-text-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-text-primary/90"
          >
            <Plus size={14} />
            New inbox
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-[8px] bg-text-primary px-3 py-2 text-sm text-white shadow-lg ring-1 ring-text-primary/20">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/15 px-2 text-xs font-bold tabular-nums">
              {selected.size}
            </span>
            <span className="font-medium">selected</span>

            <span className="mx-1 h-4 w-px bg-white/15" aria-hidden />

            <button
              onClick={() => handleBulkSetMode("thread")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-white/[0.08] px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/[0.14] disabled:opacity-50"
            >
              <MessageSquare size={12} />
              Thread mode
            </button>
            <button
              onClick={() => handleBulkSetMode("chat")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-white/[0.08] px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/[0.14] disabled:opacity-50"
            >
              <MessageCircle size={12} />
              Chat mode
            </button>
            <button
              onClick={() => handleDelete(Array.from(selected))}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-red-500/[0.16] px-2.5 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/[0.25] disabled:opacity-50"
            >
              {bulkBusy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
              Delete
            </button>

            <button
              onClick={clearSelection}
              className="ml-auto inline-flex items-center gap-1 rounded-[6px] px-2 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Clear selection"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Inline create form */}
      {createOpen && (
        <form
          onSubmit={handleCreate}
          className="rounded-[8px] bg-card p-4 ring-1 ring-border"
        >
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
            Create inbox
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.currentTarget.value)}
              placeholder="inbox@example.com"
              data-testid="inbox-create-email"
              className="h-9 flex-1 rounded-[6px] border border-border bg-card px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-text-primary/15"
            />
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.currentTarget.value)}
              placeholder="Display name (optional)"
              data-testid="inbox-create-display-name"
              className="h-9 flex-1 rounded-[6px] border border-border bg-card px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-text-primary/15"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setCreateError(null);
                }}
                className="rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-muted hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="inbox-create-button"
                disabled={creating || newEmail.trim() === ""}
                className="rounded-[6px] bg-text-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-text-primary/90 disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
          {createError && (
            <div className="mt-2 text-xs text-destructive">{createError}</div>
          )}
        </form>
      )}

      {/* Empty state */}
      {inboxes.length === 0 && !createOpen && (
        <div className="rounded-[8px] bg-card p-10 text-center ring-1 ring-border">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet/10">
            <InboxIcon size={20} style={{ color: "#7c5cfc" }} />
          </span>
          <p className="mb-1 text-sm font-medium text-text-primary">
            No inboxes yet
          </p>
          <p className="mb-4 text-xs font-light text-text-tertiary">
            Create your first inbox or wait for inbound email.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[8px] bg-text-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-text-primary/90"
          >
            <Plus size={14} />
            New inbox
          </button>
        </div>
      )}

      {/* Table */}
      {inboxes.length > 0 && (
        <div className="overflow-hidden rounded-[8px] bg-card ring-1 ring-border">
          <div className="overflow-auto smooth-scroll">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-subtle/40">
                <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  <th className="w-10 px-4 py-2.5">
                    <Checkbox
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      ariaLabel="Select all inboxes"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Address</th>
                  <th className="px-3 py-2.5 font-semibold">Display name</th>
                  <th className="px-3 py-2.5 font-semibold">Mode</th>
                  <th className="px-3 py-2.5 font-semibold">Members</th>
                  <th className="w-16 px-3 py-2.5 text-right font-semibold">
                    {/* actions */}
                  </th>
                </tr>
              </thead>
              <tbody>
                {inboxes.map((inbox) => {
                  const isSelected = selected.has(inbox.email);
                  const isEditing = editingName === inbox.email;
                  return (
                    <tr
                      key={inbox.email}
                      data-testid="inbox-row"
                      data-inbox-email={inbox.email}
                      className={cn(
                        "border-b border-border/60 transition-colors",
                        isSelected
                          ? "bg-text-primary/[0.04]"
                          : "hover:bg-text-primary/[0.02]",
                      )}
                    >
                      <td className="w-10 px-4 py-2.5">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleSelected(inbox.email)}
                          ariaLabel={`Select ${inbox.email}`}
                        />
                      </td>

                      {/* Address */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-bg-muted">
                            <InboxIcon
                              size={12}
                              className="text-text-tertiary"
                            />
                          </span>
                          <span className="truncate font-mono text-xs text-text-primary">
                            {inbox.email}
                          </span>
                        </div>
                      </td>

                      {/* Display name (inline edit) */}
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commitName(inbox, editingValue);
                                } else if (e.key === "Escape") {
                                  setEditingName(null);
                                }
                              }}
                              data-testid="inbox-display-name-input"
                              className="h-8 w-full rounded-[6px] border border-border bg-card px-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-text-primary/15"
                            />
                            <button
                              type="button"
                              onClick={() => commitName(inbox, editingValue)}
                              className="flex h-7 w-7 items-center justify-center rounded-[5px] text-text-secondary hover:bg-bg-muted hover:text-text-primary"
                              aria-label="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingName(null)}
                              className="flex h-7 w-7 items-center justify-center rounded-[5px] text-text-tertiary hover:bg-bg-muted hover:text-text-secondary"
                              aria-label="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingName(inbox.email);
                              setEditingValue(inbox.displayName ?? "");
                            }}
                            className="group/name inline-flex h-7 max-w-full items-center gap-1.5 rounded-[5px] px-2 text-left text-sm transition-colors hover:bg-bg-muted"
                          >
                            <span
                              className={cn(
                                "truncate",
                                inbox.displayName
                                  ? "text-text-primary"
                                  : "font-light italic text-text-tertiary",
                              )}
                            >
                              {inbox.displayName || "Set a name…"}
                            </span>
                            <Pencil
                              size={11}
                              className="shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover/name:opacity-100"
                            />
                          </button>
                        )}
                      </td>

                      {/* Mode */}
                      <td className="px-3 py-2.5">
                        <div className="inline-flex h-7 rounded-[5px] bg-bg-muted/60 p-0.5 ring-1 ring-border">
                          {(["thread", "chat"] as const).map((m) => {
                            const active = inbox.displayMode === m;
                            const Icon =
                              m === "thread" ? MessageSquare : MessageCircle;
                            return (
                              <button
                                key={m}
                                type="button"
                                data-testid="inbox-mode-toggle"
                                data-mode={m}
                                data-active={active}
                                onClick={() => handleSetMode(inbox, m)}
                                aria-pressed={active}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-[3px] px-2 text-[11px] font-medium transition-all",
                                  active
                                    ? "bg-card text-text-primary shadow-sm"
                                    : "text-text-secondary hover:text-text-primary",
                                )}
                              >
                                <Icon size={10} />
                                {m === "thread" ? "Thread" : "Chat"}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Members */}
                      <td className="px-3 py-2.5">
                        <MemberCell
                          inbox={inbox}
                          members={members}
                          open={memberPopover === inbox.email}
                          onOpen={() =>
                            setMemberPopover(
                              memberPopover === inbox.email
                                ? null
                                : inbox.email,
                            )
                          }
                          onClose={() => setMemberPopover(null)}
                          onToggle={(uid) => handleToggleAssignment(inbox, uid)}
                        />
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          data-testid="inbox-delete-button"
                          onClick={() => handleDelete([inbox.email])}
                          aria-label={`Delete inbox ${inbox.email}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-[5px] text-text-tertiary opacity-60 transition-all hover:bg-destructive/10 hover:text-destructive hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}
function Checkbox({ checked, onChange, ariaLabel }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        checked
          ? "border-text-primary bg-text-primary text-white"
          : "border-border bg-card hover:border-text-primary/40",
      )}
    >
      {checked && (
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.5L4.75 8.75L9.5 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

interface MemberCellProps {
  inbox: AdminInbox;
  members: AdminUser[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: (userId: string) => void;
}

function MemberCell({
  inbox,
  members,
  open,
  onOpen,
  onClose,
  onToggle,
}: MemberCellProps) {
  const assigned = members.filter((m) => inbox.assignedUserIds.includes(m.id));
  const display = assigned.slice(0, 3);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-7 items-center gap-1.5 rounded-[5px] px-2 text-xs transition-colors hover:bg-bg-muted"
      >
        {display.length === 0 ? (
          <span className="font-light text-text-tertiary">
            Admins only · assign…
          </span>
        ) : (
          <>
            <div className="flex -space-x-1">
              {display.map((u) => (
                <span
                  key={u.id}
                  title={u.name || u.email}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-bg-muted text-[9px] font-semibold text-text-secondary ring-2 ring-card"
                >
                  {(u.name || u.email)[0]?.toUpperCase()}
                </span>
              ))}
            </div>
            <span className="text-text-secondary">
              {assigned.length} member{assigned.length !== 1 ? "s" : ""}
            </span>
          </>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10"
            aria-hidden
            onClick={onClose}
            tabIndex={-1}
          />
          <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-[8px] border border-border bg-card py-1 shadow-lg">
            <div className="border-b border-border px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                Members for {inbox.email.split("@")[0]}
              </p>
              <p className="mt-0.5 text-[11px] font-light text-text-tertiary">
                Admins always have access.
              </p>
            </div>
            <div className="max-h-56 overflow-y-auto smooth-scroll py-1">
              {members.length === 0 ? (
                <p className="px-3 py-2 text-xs font-light text-text-tertiary">
                  No members to assign.
                </p>
              ) : (
                members.map((u) => {
                  const on = inbox.assignedUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      data-testid="inbox-member-toggle"
                      data-user-id={u.id}
                      data-assigned={on}
                      onClick={() => onToggle(u.id)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-bg-muted"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-muted text-[10px] font-semibold text-text-secondary">
                          {(u.name || u.email)[0]?.toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-text-primary">
                            {u.name || u.email}
                          </span>
                          {u.name && (
                            <span className="block truncate text-[10px] font-light text-text-tertiary">
                              {u.email}
                            </span>
                          )}
                        </span>
                      </div>
                      <Checkbox
                        checked={on}
                        onChange={() => onToggle(u.id)}
                        ariaLabel={`${on ? "Unassign" : "Assign"} ${u.name || u.email}`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
