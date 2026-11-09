import { useCallback, useEffect, useRef, useState } from "react";
import { firebaseErrorMessage } from "../firebase/errors";
import { loadAiConsent, setAiConsent } from "./consent";

export function useAiConsent() {
  const [status, setStatus] = useState<"loading" | "agreed" | "not-agreed" | "error">("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      setStatus(await loadAiConsent() ? "agreed" : "not-agreed");
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const change = useCallback(async (agreed: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await setAiConsent(agreed);
      setStatus(agreed ? "agreed" : "not-agreed");
    } catch (failure) {
      setError(firebaseErrorMessage(failure));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  return { status, error, saving, refresh, change };
}
