"use strict";
/*
 * SysModeller – Prozessmodell: vom Kundenprozess zur Maschinenstruktur.
 *
 * Der Kunde gibt den Prozess vor. Der Vertrieb modelliert ihn als Schritte,
 * wählt je Schritt die benötigten Funktionen und je Funktion das
 * Lösungsprinzip (z. B. „Pneumatisch spannen“). Hinter jeder Lösung steht
 * ein Standardmodul (CTO) oder – wo es noch keinen Standard gibt – eine
 * ETO-Hülle, die das Engineering ausarbeitet.
 *
 * `erzeugeStruktur` baut daraus die Maschinenstruktur: je Prozessschritt eine
 * Station in Prozessreihenfolge, darin je gewählter Lösung die Modulinstanz
 * bzw. Hülle. Der Abgleich ist schonend: von Hand ergänzte Elemente bleiben
 * stehen, nur generierte Elemente werden nachgezogen. Jedes generierte
 * Element kennt seine Herkunft (Schritt/Funktion/Lösung) – Rückverfolgbarkeit
 * inklusive.
 */
(function (ns) {

  function dep(name, pfad) {
    if (ns[name]) return ns[name];
    return require(pfad);
  }

  function neuerSchritt(vorgabe) {
    const Model = dep("Model", "./model.js");
    return Object.assign({
      id: Model.neueId("ps"),
      name: "Neuer Prozessschritt",
      beschreibung: "",
      funktionen: [],   // [{ id, funktionId, loesungId }]
    }, vorgabe || {});
  }

  function neuerFunktionsEintrag(vorgabe) {
    const Model = dep("Model", "./model.js");
    return Object.assign({
      id: Model.neueId("fe"),
      funktionId: "",
      loesungId: "",
    }, vorgabe || {});
  }

  /** Elemente, die aus einem bestimmten Prozessschritt generiert wurden. */
  function generierteStation(projekt, schrittId) {
    return projekt.elemente.find((e) =>
      e.generiert && e.herkunftFunktion && e.herkunftFunktion.art === "schritt" &&
      e.herkunftFunktion.schrittId === schrittId) || null;
  }

  /**
   * Gleicht die Maschinenstruktur mit dem Prozess ab.
   * Liefert einen Bericht als Liste lesbarer Sätze.
   */
  function erzeugeStruktur(projekt, bibliothek) {
    const Model = dep("Model", "./model.js");
    const Bibliothek = dep("Bibliothek", "./bibliothek.js");
    const bericht = [];
    projekt.prozess = projekt.prozess || [];

    let wurzel = projekt.elemente.find((e) => !e.elternId);
    if (!wurzel) {
      wurzel = Model.neuesElement({ name: projekt.projekt.name || "Anlage", typ: "Anlage", kuerzel: "ANL" });
      projekt.elemente.push(wurzel);
    }

    // 1. Generierte Stationen entfernen, deren Prozessschritt gelöscht wurde.
    const schrittIds = new Set(projekt.prozess.map((s) => s.id));
    for (const el of [...projekt.elemente]) {
      if (el.generiert && el.herkunftFunktion && el.herkunftFunktion.art === "schritt" &&
          !schrittIds.has(el.herkunftFunktion.schrittId)) {
        Model.entferneElement(projekt, el.id);
        bericht.push(`Station „${el.name}“ entfernt – der Prozessschritt existiert nicht mehr.`);
      }
    }

    // 2. Je Prozessschritt: Station sicherstellen, Lösungen abgleichen.
    for (const schritt of projekt.prozess) {
      let station = generierteStation(projekt, schritt.id);
      if (!station) {
        station = Model.neuesElement({ name: schritt.name, typ: "Station", elternId: wurzel.id });
        station.generiert = true;
        station.herkunftFunktion = { art: "schritt", schrittId: schritt.id };
        // Startposition im 2D-Layout: rechts neben dem bisher letzten Modul.
        const belegteX = Model.kinder(projekt, wurzel.id)
          .filter((e) => e.layout && typeof e.layout.x === "number")
          .map((e) => e.layout.x);
        station.layout = { x: belegteX.length ? Math.max(...belegteX) + 7 : 0, y: 0 };
        projekt.elemente.push(station);
        bericht.push(`Station „${schritt.name}“ angelegt.`);
      }

      // 2a. Generierte Kinder entfernen, deren Eintrag weg ist oder deren Lösung wechselte.
      for (const kind of [...Model.kinder(projekt, station.id)]) {
        if (!kind.generiert || !kind.herkunftFunktion || kind.herkunftFunktion.art !== "funktion") continue;
        const eintrag = (schritt.funktionen || []).find((f) => f.id === kind.herkunftFunktion.eintragId);
        if (!eintrag || (eintrag.loesungId || "") !== (kind.herkunftFunktion.loesungId || "")) {
          Model.entferneElement(projekt, kind.id);
          bericht.push(`„${kind.name}“ aus „${station.name}“ entfernt – ${eintrag ? "die Lösung wurde geändert" : "die Funktion wurde entfernt"}.`);
        }
      }

      // 2b. Fehlende Lösungen einfügen.
      for (const eintrag of schritt.funktionen || []) {
        if (!eintrag.loesungId) continue;
        const vorhanden = Model.kinder(projekt, station.id).find((k) =>
          k.generiert && k.herkunftFunktion && k.herkunftFunktion.eintragId === eintrag.id);
        if (vorhanden) continue;

        const funktion = Bibliothek.findeFunktion(bibliothek, eintrag.funktionId);
        const loesung = Bibliothek.findeLoesung(bibliothek, eintrag.loesungId);
        if (!loesung) continue;
        const modul = Bibliothek.modulZuLoesung(bibliothek, loesung);

        let neu;
        if (modul) {
          neu = Bibliothek.einfuegen(projekt, modul, station.id);
          bericht.push(`„${neu.name}“ (Standard „${modul.name}“ v${modul.version}) in „${station.name}“ eingefügt.`);
        } else {
          neu = Model.neuesElement({
            name: Model.eindeutigerName(projekt, station.id, loesung.name),
            typ: "Baugruppe",
            elternId: station.id,
            kommentar: "Sonderlösung (ETO) – wird vom Engineering ausgearbeitet.",
          });
          neu.eto = true;
          projekt.elemente.push(neu);
          bericht.push(`Sonderlösung (ETO) „${neu.name}“ in „${station.name}“ angelegt – Engineering erforderlich.`);
        }
        neu.generiert = true;
        neu.herkunftFunktion = {
          art: "funktion",
          eintragId: eintrag.id,
          schrittId: schritt.id,
          schrittName: schritt.name,
          funktionName: funktion ? funktion.name : "?",
          loesungName: loesung.name,
          loesungId: eintrag.loesungId,
        };
      }
    }

    // 3. Reihenfolge: generierte Stationen in Prozessfolge, Handangelegtes danach.
    const schrittFolge = new Map(projekt.prozess.map((s, i) => [s.id, i]));
    ordneWurzelkinder(projekt, wurzel, (el) =>
      el.generiert && el.herkunftFunktion && schrittFolge.has(el.herkunftFunktion.schrittId)
        ? schrittFolge.get(el.herkunftFunktion.schrittId) : 10000);

    if (!bericht.length) bericht.push("Die Struktur war bereits auf dem Stand des Prozesses.");
    return bericht;
  }

  /** Wurzelkinder stabil nach einem Sortierschlüssel ordnen (Unterbäume bleiben intakt). */
  function ordneWurzelkinder(projekt, wurzel, schluessel) {
    const Model = dep("Model", "./model.js");
    const kinder = Model.kinder(projekt, wurzel.id);
    const sortiert = kinder.slice().sort((a, b) => schluessel(a) - schluessel(b));
    const neuFolge = [];
    function absteigen(el) {
      neuFolge.push(el);
      for (const kind of Model.kinder(projekt, el.id)) absteigen(kind);
    }
    neuFolge.push(wurzel);
    for (const kind of sortiert) absteigen(kind);
    for (const el of projekt.elemente) if (!neuFolge.includes(el)) neuFolge.push(el);
    projekt.elemente = neuFolge;
  }

  /**
   * Übernimmt die 2D-Layout-Reihenfolge (links nach rechts, dann oben nach
   * unten) in die Strukturreihenfolge – damit folgt auch die Nummerierung
   * der Kennzeichen der Halle.
   */
  function reihenfolgeAusLayout(projekt) {
    const Model = dep("Model", "./model.js");
    const wurzel = projekt.elemente.find((e) => !e.elternId);
    if (!wurzel) return;
    ordneWurzelkinder(projekt, wurzel, (el) =>
      el.layout && typeof el.layout.x === "number"
        ? el.layout.x + el.layout.y * 0.001
        : 100000);
  }

  /** ETO-Hüllen (Sonderlösungen) im wirksamen Umfang. */
  function etoElemente(projekt, elementStatus) {
    return projekt.elemente.filter((e) => e.eto &&
      (!elementStatus || !elementStatus[e.id] || elementStatus[e.id].effektivEnthalten));
  }

  const api = { neuerSchritt, neuerFunktionsEintrag, generierteStation, erzeugeStruktur, etoElemente, reihenfolgeAusLayout };

  ns.Prozess = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

})(typeof window !== "undefined" ? (window.SysM = window.SysM || {}) : {});
