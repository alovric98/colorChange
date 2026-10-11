"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Status = "none" | "queued" | "working" | "done" | "error" | "empty";

interface Props {
  league: string;
  date: string;
  status: Status;
  done: number;
  total: number | null;
  updatedAtLabel: string | null;
  error: string | null;
}

const PW_KEY = "pk-password";
const POLL_MS = 5000;

function readPassword(): string {
  try {
    return localStorage.getItem(PW_KEY) ?? "";
  } catch {
    return "";
  }
}

export function AnalysisControls(props: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(props.status);
  const [progress, setProgress] = useState({ done: props.done, total: props.total });
  const [askPassword, setAskPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pendingRefresh = useRef<boolean>(false);

  useEffect(() => {
    setStatus(props.status);
    setProgress({ done: props.done, total: props.total });
  }, [props.status, props.done, props.total, props.league, props.date]);

  const inProgress = status === "queued" || status === "working";

  // Automatsko osvježavanje dok analiza traje.
  useEffect(() => {
    if (!inProgress) return;
    let lastDone = progress.done;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/analysis?league=${props.league}&date=${props.date}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status: Status; done?: number; total?: number };
        setProgress({ done: data.done ?? 0, total: data.total ?? null });
        if (data.status !== "queued" && data.status !== "working") {
          setStatus(data.status);
          router.refresh();
        } else if ((data.done ?? 0) !== lastDone) {
          lastDone = data.done ?? 0;
          router.refresh();
        }
      } catch {
        // mreža – pokušaj u sljedećem krugu
      }
    }, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inProgress, props.league, props.date, router]);

  const start = useCallback(
    async (refresh: boolean, pw?: string) => {
      const secret = pw ?? readPassword();
      if (!secret) {
        pendingRefresh.current = refresh;
        setAskPassword(true);
        return;
      }
      setBusy(true);
      setMessage(null);
      try {
        const res = await fetch("/api/analysis", {
          method: "POST",
          headers: { "content-type": "application/json", "x-app-password": secret },
          body: JSON.stringify({ league: props.league, date: props.date, refresh }),
        });
        if (res.status === 401) {
          try {
            localStorage.removeItem(PW_KEY);
          } catch {}
          pendingRefresh.current = refresh;
          setAskPassword(true);
          setMessage("Pogrešna lozinka.");
          return;
        }
        const data = (await res.json()) as { status?: Status; error?: string };
        if (!res.ok) {
          setMessage(data.error ?? "Pokretanje nije uspjelo.");
          return;
        }
        try {
          localStorage.setItem(PW_KEY, secret);
        } catch {}
        setAskPassword(false);
        setStatus(data.status ?? "queued");
        router.refresh();
      } catch {
        setMessage("Mreža nije dostupna. Pokušaj ponovno.");
      } finally {
        setBusy(false);
      }
    },
    [props.league, props.date, router],
  );

  return (
    <div className="controls" aria-live="polite">
      {inProgress ? (
        <div className="progress">
          <span className="spinner" aria-hidden />
          <span>
            Analiza je u tijeku
            {progress.total ? ` (${progress.done}/${progress.total})` : "…"}
          </span>
        </div>
      ) : status === "none" ? (
        <div className="row">
          <span>Za ovu ligu i dan još nema analize.</span>
          <button className="btn" type="button" disabled={busy} onClick={() => start(false)}>
            Analiziraj ovu ligu
          </button>
        </div>
      ) : (
        <div className="row">
          <button className="btn secondary" type="button" disabled={busy} onClick={() => start(true)}>
            {status === "error" ? "Pokušaj ponovno" : "Osvježi analizu"}
          </button>
          {props.updatedAtLabel && <span className="meta">Ažurirano {props.updatedAtLabel}</span>}
        </div>
      )}

      {status === "error" && props.error && !inProgress && (
        <div className="error-text">Analiza nije uspjela: {props.error}</div>
      )}

      {askPassword && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (password) start(pendingRefresh.current, password);
          }}
        >
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            placeholder="Lozinka za analizu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Lozinka za analizu"
          />
          <button className="btn" type="submit" disabled={busy || !password}>
            Potvrdi
          </button>
        </form>
      )}
      {message && <div className="error-text">{message}</div>}
    </div>
  );
}
