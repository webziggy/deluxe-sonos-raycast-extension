import { useState, useEffect, useRef } from "react";
import { Cache, getPreferenceValues } from "@raycast/api";
import { getHAConnection, filterSonosPlayers, getGroupedPlayers } from "./api";
import { subscribeEntities } from "home-assistant-js-websocket";

const cache = new Cache();

export function useSonosPlayers() {
  const [players, setPlayers] = useState<any[]>(() => {
    const cached = cache.get("sonosPlayers");
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { return []; }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(!cache.has("sonosPlayers"));
  const [error, setError] = useState<string>();
  
  const lastJsonRef = useRef(cache.get("sonosPlayers") || "");

  useEffect(() => {
    let unsubscribe: () => void;
    
    getHAConnection().then((connection) => {
      unsubscribe = subscribeEntities(connection, (newEntities) => {
        const sonosPlayers = filterSonosPlayers(newEntities);
        const groupedPlayers = getGroupedPlayers(sonosPlayers);
        
        const currentJson = JSON.stringify(groupedPlayers);
        
        if (currentJson !== lastJsonRef.current) {
          const prefs = getPreferenceValues<{debugLogging?: boolean}>();
          if (prefs.debugLogging) console.log(new Date().toISOString(), "[DEBUG]", "Sonos state changed, triggering React update.");
          
          lastJsonRef.current = currentJson;
          setPlayers(groupedPlayers);
          cache.set("sonosPlayers", currentJson);
        }
        setIsLoading(false);
      });
    }).catch((err) => {
      console.error(err);
      setError(String(err));
      setIsLoading(false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return { players, isLoading, error };
}
