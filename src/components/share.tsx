"use client";
import { useId, useRef, useState } from "react";
import { stopShareTitle } from "@/lib/share-metadata";

export function Share({ text, url }: { text: string; url: string }) {
  text = stopShareTitle(text);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const heading = useId();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const links = [
    [
      "WhatsApp",
      "https://wa.me/?" + new URLSearchParams({ text: `${text}\n${url}` }),
    ],
    [
      "Facebook",
      "https://www.facebook.com/sharer/sharer.php?" +
        new URLSearchParams({ u: url }),
    ],
    [
      "X",
      "https://twitter.com/intent/tweet?" + new URLSearchParams({ text, url }),
    ],
  ];
  function showOptions() {
    setMessage("");
    dialog.current?.showModal();
  }
  return (
    <>
      <button
        type="button"
        className="share-button"
        ref={trigger}
        disabled={busy}
        aria-haspopup="dialog"
        onClick={async () => {
          if (
            navigator.share &&
            window.matchMedia("(pointer: coarse)").matches
          ) {
            setBusy(true);
            try {
              await navigator.share({ text, url });
            } catch (error) {
              if ((error as Error).name !== "AbortError") showOptions();
            } finally {
              setBusy(false);
            }
          } else showOptions();
        }}
      >
        مشاركة
      </button>
      <dialog
        ref={dialog}
        className="share-dialog"
        aria-labelledby={heading}
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          if (event.target === dialog.current) {
            const rect = dialog.current.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              dialog.current.close();
          }
        }}
      >
        <div className="share-heading">
          <h2 id={heading}>مشاركة STOP</h2>
          <button
            type="button"
            className="share-close"
            onClick={() => dialog.current?.close()}
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>
        <p className="share-text">{text}</p>
        <div className="share-options">
          {links.map(([label, href]) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
            >
              {label}
            </a>
          ))}
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setMessage("تنسخ الرابط.");
              } catch {
                setMessage("حدد الرابط ونسخو يدوياً.");
                input.current?.focus();
                input.current?.select();
              }
            }}
          >
            نسخ الرابط
          </button>
        </div>
        <label className="sr-only" htmlFor={heading + "-url"}>
          رابط STOP
        </label>
        <input
          ref={input}
          id={heading + "-url"}
          className="share-url"
          value={url}
          readOnly
          dir="ltr"
          onFocus={(event) => event.currentTarget.select()}
        />
        <p className="share-status" role="status">
          {message}
        </p>
      </dialog>
    </>
  );
}
