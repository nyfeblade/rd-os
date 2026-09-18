import { useCallback, useEffect, useState } from "react";
import { loadDump, type DumpState } from "./loadDump";

export function useDump(): { state: DumpState; retry: () => void } {
  const [state, setState] = useState<DumpState>({ status: "loading" });

  const retry = useCallback(() => {
    setState({ status: "loading" });
    void loadDump().then(setState);
  }, []);

  useEffect(() => {
    void loadDump().then(setState);
  }, []);

  return { state, retry };
}
