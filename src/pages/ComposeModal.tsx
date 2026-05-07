import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Send, AtSign, PenSquare, Type } from "lucide-react";
import TiptapEditor from "@/components/TiptapEditor";
import { sendEmail, fetchStats } from "@/lib/api";
import { getFromLabel } from "@/lib/format";

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Compose drawer — opens from the right edge to match ReplyComposer.
 * Single "Freeform" mode for now (no template support); structurally
 * mirrors the reply experience so the two feel like the same component.
 */
export default function ComposeModal({ open, onClose }: ComposeModalProps) {
  const [to, setTo] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [senderIdentities, setSenderIdentities] = useState<
    Array<{ email: string; displayName: string | null }>
  >([]);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // TipTap emits "<p></p>" for an empty editor — treat that as empty.
  const bodyIsEmpty = !bodyHtml || bodyHtml === "<p></p>";

  useEffect(() => {
    if (open) {
      fetchStats().then((stats) => {
        setRecipients(stats.recipients);
        setSenderIdentities(stats.senderIdentities ?? []);
        if (!fromAddress && stats.recipients.length > 0) {
          setFromAddress(stats.recipients[0]);
        }
      });
    } else {
      setTo("");
      setSubject("");
      setBodyHtml("");
      setError("");
    }
  }, [open]);

  async function handleSend() {
    if (!to || bodyIsEmpty) return;
    setSending(true);
    setError("");
    try {
      await sendEmail({ to, fromAddress, subject, bodyHtml });
      onClose();
    } catch {
      setError("Failed to send email");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!open) return null;

  return (
    <DialogPrimitive.Root open onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="drawer-overlay fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          onKeyDown={handleKeyDown}
          className="drawer-content fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-card shadow-2xl ring-1 ring-border focus:outline-none sm:max-w-[920px]"
        >
          {/* Header */}
          <div className="shrink-0 border-b border-border bg-card px-6 pb-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: "rgba(124, 92, 252, 0.12)",
                    color: "#5b3ce6",
                  }}
                >
                  <PenSquare size={18} />
                </span>
                <div className="min-w-0">
                  <DialogPrimitive.Title className="text-lg font-extrabold tracking-tight text-text-primary">
                    Compose
                  </DialogPrimitive.Title>
                  <p className="mt-0.5 truncate text-sm font-light text-text-tertiary">
                    Send a new email from one of your inboxes
                  </p>
                </div>
              </div>
              <DialogPrimitive.Close
                className="shrink-0 rounded-[8px] p-1.5 text-text-tertiary transition-colors hover:bg-bg-muted hover:text-text-primary"
                aria-label="Close"
              >
                <X size={18} />
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Metadata: From / To / Subject */}
          <div className="shrink-0 space-y-1 border-b border-border bg-bg-subtle/40 px-6 py-3">
            <div className="grid grid-cols-[60px_1fr] items-center gap-3 py-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                <AtSign size={11} />
                From
              </span>
              <select
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                required
                className="rounded-[6px] border border-border bg-card px-2 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-text-primary/15"
              >
                {recipients.map((r) => (
                  <option key={r} value={r}>
                    {getFromLabel(r, senderIdentities)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-[60px_1fr] items-center gap-3 py-1">
              <label
                htmlFor="compose-to"
                className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-text-tertiary"
              >
                <Send size={11} />
                To
              </label>
              <input
                id="compose-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
                placeholder="recipient@example.com"
                aria-label="To"
                className="rounded-[6px] border border-border bg-card px-2 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-text-primary/15"
              />
            </div>
            <div className="grid grid-cols-[60px_1fr] items-center gap-3 py-1">
              <label
                htmlFor="compose-subject"
                className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-text-tertiary"
              >
                <Type size={11} />
                Subject
              </label>
              <input
                id="compose-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="What's it about?"
                aria-label="Subject"
                className="rounded-[6px] border border-border bg-card px-2 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-text-primary/15"
              />
            </div>
          </div>

          {/* Body */}
          <div
            className="smooth-scroll min-h-0 flex-1 overflow-y-auto bg-card"
            data-testid="compose-body"
          >
            <div className="flex h-full min-h-[320px] flex-col p-6">
              <TiptapEditor content={bodyHtml} onUpdate={setBodyHtml} />
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border bg-card px-6 py-3">
            {error && (
              <p className="mb-2 text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="hidden text-[11px] font-light text-text-tertiary sm:block">
                <kbd className="rounded border border-border bg-bg-muted px-1 font-mono text-[10px]">
                  ⌘
                </kbd>
                <kbd className="ml-1 rounded border border-border bg-bg-muted px-1 font-mono text-[10px]">
                  Enter
                </kbd>
                <span className="ml-1.5">to send</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="compose-send-button"
                  onClick={handleSend}
                  disabled={sending || bodyIsEmpty || !to}
                  className="inline-flex items-center gap-1.5 rounded-[6px] bg-text-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-text-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={12} />
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
