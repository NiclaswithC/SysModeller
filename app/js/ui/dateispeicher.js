"use strict";
/*
 * SysModeller – Ablage für 3D-Dateien (GLB/GLTF) im Browser (IndexedDB).
 * Die Projektdatei bleibt klein: Sie verweist nur über eine dateiId auf die
 * Geometrie; die Binärdaten liegen getrennt auf diesem Rechner.
 */
const Dateispeicher = (() => {
  const DB_NAME = "sysmodeller";
  const STORE = "dateien";

  function oeffnen() {
    return new Promise((aufloesen, ablehnen) => {
      const anfrage = indexedDB.open(DB_NAME, 1);
      anfrage.onupgradeneeded = () => {
        if (!anfrage.result.objectStoreNames.contains(STORE)) {
          anfrage.result.createObjectStore(STORE);
        }
      };
      anfrage.onsuccess = () => aufloesen(anfrage.result);
      anfrage.onerror = () => ablehnen(anfrage.error);
    });
  }

  async function speichere(dateiId, arrayBuffer, name) {
    const db = await oeffnen();
    return new Promise((aufloesen, ablehnen) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ daten: arrayBuffer, name }, dateiId);
      tx.oncomplete = () => aufloesen();
      tx.onerror = () => ablehnen(tx.error);
    });
  }

  async function lade(dateiId) {
    const db = await oeffnen();
    return new Promise((aufloesen, ablehnen) => {
      const anfrage = db.transaction(STORE, "readonly").objectStore(STORE).get(dateiId);
      anfrage.onsuccess = () => aufloesen(anfrage.result || null);
      anfrage.onerror = () => ablehnen(anfrage.error);
    });
  }

  async function loesche(dateiId) {
    const db = await oeffnen();
    return new Promise((aufloesen, ablehnen) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(dateiId);
      tx.oncomplete = () => aufloesen();
      tx.onerror = () => ablehnen(tx.error);
    });
  }

  return { speichere, lade, loesche };
})();
