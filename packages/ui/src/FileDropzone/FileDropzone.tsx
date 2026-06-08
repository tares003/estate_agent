'use client';

import {
  useCallback,
  useId,
  useRef,
  useState,
  type DragEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import './FileDropzone.css';

export interface FileDropzoneProps {
  /**
   * Visible field label. Rendered as a real `<label>` that wraps the
   * `<input type="file">`, so a click anywhere on the dropzone — and keyboard
   * Enter / Space on the focused input — opens the OS picker. Used as the
   * input's accessible name (G9 — never placeholder-only).
   */
  label: ReactNode;
  /**
   * The `accept` attribute for the native input (e.g. `image/*`,
   * `application/pdf,.docx`). Also enforced on dropped files: a file whose type
   * does not satisfy `accept` is rejected and reported in the error region.
   */
  accept?: string;
  /** Allow selecting more than one file. Defaults to `false` (single-select). */
  multiple?: boolean;
  /**
   * Maximum size per file, in bytes. Files larger than this are rejected and
   * reported in the error region. Omit for no size limit.
   */
  maxSizeBytes?: number;
  /**
   * Called with the current list of accepted files whenever the selection
   * changes (after add, drop, or remove). In single-select mode this is at most
   * one file; in multiple mode it is the cumulative selection.
   */
  onFiles: (files: File[]) => void;
  /**
   * Supporting text shown beneath the dropzone. Wired to the input via
   * `aria-describedby` so assistive technology reads it with the control.
   */
  hint?: ReactNode;
  /** Optional id for the input; generated with `useId` when omitted. */
  id?: string;
  /** Extra class applied to the outer field wrapper. */
  className?: string;
}

/** Join class-name fragments, dropping any falsy ones. */
function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Human-readable byte size for the rejection message. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Does a file satisfy an `accept` attribute string? Mirrors the browser's own
 * matching: a comma-separated list of MIME types (with `*` wildcards) and/or
 * filename extensions (`.pdf`). An empty / absent accept matches everything.
 */
function matchesAccept(file: File, accept: string | undefined): boolean {
  if (accept == null || accept.trim() === '') return true;
  const tokens = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  return tokens.some((token) => {
    if (token.startsWith('.')) {
      return name.endsWith(token);
    }
    if (token.endsWith('/*')) {
      const prefix = token.slice(0, token.indexOf('/') + 1); // e.g. "image/"
      return type.startsWith(prefix);
    }
    return type === token;
  });
}

/** A rejected file plus the reason, surfaced in the alert region. */
interface Rejection {
  name: string;
  reason: string;
}

/**
 * FileDropzone — a keyboard-accessible drag-and-drop upload control
 * (design-requirements §1: keyboard equivalents for every drag-and-drop
 * interaction). A real `<label>` wraps a visually-hidden `<input type="file">`,
 * so clicking the dropzone or pressing Enter / Space on the focused input opens
 * the OS picker — the drag-and-drop affordance is purely additive.
 *
 * Accessible by construction (G9): the input carries the accessible name via the
 * wrapping label and supporting `hint` via `aria-describedby`; the drag-over
 * state is mirrored to a `role="status" aria-live="polite"` region; rejected
 * files (wrong type / oversize) are announced through a `role="alert"` region
 * (status conveyed by text, not colour alone); every selected file gets a named
 * remove button. Token-driven via `FileDropzone.css` (G7). This is the input UI
 * only — actual upload (pre-signed or otherwise) is the consumer's job.
 */
export function FileDropzone({
  label,
  accept,
  multiple = false,
  maxSizeBytes,
  onFiles,
  hint,
  id,
  className,
}: FileDropzoneProps): ReactElement {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;

  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  /** Depth counter so nested dragenter/dragleave don't flicker the state. */
  const dragDepth = useRef(0);
  /**
   * Mirror of `files` so the next selection can be computed synchronously
   * (outside the setState updater), letting `onFiles` be called after the
   * state commit rather than during render (React forbids parent setState in a
   * setState updater).
   */
  const filesRef = useRef<File[]>([]);

  /** Commit a new selection: update state, keep the ref in sync, notify the parent. */
  const commitFiles = useCallback(
    (next: File[]): void => {
      filesRef.current = next;
      setFiles(next);
      onFiles(next);
    },
    [onFiles],
  );

  /** Split an incoming batch into accepted files and rejections. */
  const partition = useCallback(
    (incoming: File[]): { accepted: File[]; rejected: Rejection[] } => {
      const accepted: File[] = [];
      const rejected: Rejection[] = [];
      for (const file of incoming) {
        if (!matchesAccept(file, accept)) {
          rejected.push({
            name: file.name,
            reason: 'this file type is not accepted',
          });
          continue;
        }
        if (maxSizeBytes != null && file.size > maxSizeBytes) {
          rejected.push({
            name: file.name,
            reason: `the file is too large (maximum ${formatBytes(maxSizeBytes)})`,
          });
          continue;
        }
        accepted.push(file);
      }
      return { accepted, rejected };
    },
    [accept, maxSizeBytes],
  );

  /** Validate and merge an incoming batch into the selection, notifying the parent. */
  const addFiles = useCallback(
    (incoming: File[]): void => {
      if (incoming.length === 0) return;
      const { accepted, rejected } = partition(incoming);
      setRejections(rejected);

      if (accepted.length === 0) return;

      const next = multiple ? [...filesRef.current, ...accepted] : accepted.slice(-1);
      commitFiles(next);
    },
    [partition, multiple, commitFiles],
  );

  const onInputChange = useCallback((): void => {
    const list = inputRef.current?.files;
    addFiles(list ? Array.from(list) : []);
    // Reset the native input so selecting the same file again still fires change.
    if (inputRef.current) inputRef.current.value = '';
  }, [addFiles]);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragOver(false);
      const list = event.dataTransfer?.files;
      addFiles(list ? Array.from(list) : []);
    },
    [addFiles],
  );

  const onDragEnter = useCallback((event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragOver(true);
  }, []);

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>): void => {
    // Required so the element is registered as a valid drop target.
    event.preventDefault();
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragOver(false);
  }, []);

  const removeAt = useCallback(
    (index: number): void => {
      const next = filesRef.current.filter((_, i) => i !== index);
      commitFiles(next);
    },
    [commitFiles],
  );

  const describedBy = hint != null && hint !== false ? hintId : undefined;

  // Clicking anywhere on the dropzone surface (not just the label text) opens
  // the picker — the generous hit area is part of the drag-and-drop affordance.
  // The <label htmlFor> already handles its own region natively, so forward only
  // clicks that landed outside it to avoid a double-fire.
  const onSurfaceClick = useCallback((event: { target: EventTarget | null }): void => {
    const labelEl = inputRef.current?.closest('.filedropzone')?.querySelector('label');
    if (labelEl && event.target instanceof Node && labelEl.contains(event.target)) return;
    inputRef.current?.click();
  }, []);

  return (
    <div className={cx('filedropzone-field', className)}>
      {/* The dropzone container holds the drag handlers and a redundant pointer
       * affordance over the real <input>; the keyboard-operable, accessible path
       * is the <label htmlFor> + <input> it contains, so the handlers sit on a
       * presentation container wrapping a genuine control (jsx-a11y clean, G9). */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        data-testid="filedropzone"
        className={cx('filedropzone', isDragOver && 'is-dragover')}
        onDrop={onDrop}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onSurfaceClick}
      >
        <span className="filedropzone-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 16V4M7 9l5-5 5 5" />
            <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
        </span>
        {/* The label contains ONLY the field label, so the input's accessible
         * name is exactly that text (not the icon / CTA). */}
        <label className="filedropzone-label" htmlFor={inputId}>
          {label}
        </label>
        <span className="filedropzone-cta" aria-hidden="true">
          Drag and drop, or browse
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="filedropzone-input"
          accept={accept}
          multiple={multiple}
          aria-describedby={describedBy}
          onChange={onInputChange}
        />
      </div>

      {/* Drag-over announcement for assistive tech (polite — never interrupts). */}
      <div
        className="filedropzone-sr"
        data-testid="filedropzone-status"
        role="status"
        aria-live="polite"
      >
        {isDragOver ? 'Drop the files to add them.' : ''}
      </div>

      {hint != null && hint !== false ? (
        <span className="filedropzone-hint" id={hintId}>
          {hint}
        </span>
      ) : null}

      {rejections.length > 0 ? (
        <div className="filedropzone-error" role="alert">
          <span className="filedropzone-error-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6M12 16h.01" />
            </svg>
          </span>
          <ul className="filedropzone-error-list">
            {rejections.map((rejection, index) => (
              <li key={`${rejection.name}-${index}`}>
                <strong>{rejection.name}</strong> was not added — {rejection.reason}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="filedropzone-files" aria-label="Selected files">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="filedropzone-file">
              <span className="filedropzone-file-name">{file.name}</span>
              <span className="filedropzone-file-size">{formatBytes(file.size)}</span>
              <button
                type="button"
                className="filedropzone-remove"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeAt(index)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
