import { useEffect, useState } from "react";
import type { FleetData } from "./fleet-types";

const assetBase = import.meta.env.BASE_URL.replace(/\/$/u, "");

export function useFleetData() {
  const [data, setData] = useState<FleetData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${assetBase}/fleet-data.json`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        return response.json() as Promise<FleetData>;
      })
      .then(setData)
      .catch((currentError: Error) => setError(currentError.message));
  }, []);

  return { data, error };
}
