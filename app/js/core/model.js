"use strict";
/*
 * SysModeller – neutrales Datenmodell (Kern).
 *
 * Das Modell ist bewusst klein gehalten und PLM-frei. Es trennt:
 *   - Struktur (elemente)          -> Anlagengliederung, angelehnt an ISA-88
 *   - Merkmale (merkmale)          -> Merkmal getrennt vom Merkmalwert (vgl. ECLASS/IRDI)
 *   - Regeln (regeln)              -> datengetriebene Varianten
 *   - Konfigurationen              -> beantwortete Fragen = eine Variante
 *   - Kennzeichnung (kennzeichnung)-> Einstellungen für BMK/PLC-Tags (IEC 81346)
 *
 * Läuft im Browser (globales Objekt SysM.Model) und in Node (module.exports).
 */
(function (ns) {

  const SCHEMA = "sysmodeller/1";

  // Ebenen der Anlagengliederung. Zuordnung zu ISA-88 (physisches Modell):
  // Anlage ~ Prozesszelle, Teilanlage ~ Unit, Station/Baugruppe ~ Equipment Module,
  // Komponente ~ Control Module. Dokumentiert in docs/datenmodell.md.
  const ELEMENT_TYPEN = ["Anlage", "Teilanlage", "Station", "Baugruppe", "Komponente"];

  // Übliche Hauptklassen nach IEC 81346-2 als Auswahlhilfe; frei überschreibbar.
  const PRODUKT_KLASSEN = [
    { code: "B", text: "Sensor / Messgrößenumformer" },
    { code: "E", text: "Heizung / Beleuchtung / Kühlung" },
    { code: "F", text: "Schutzeinrichtung (Sicherung, Schutzschalter)" },
    { code: "G", text: "Energieversorgung (Netzteil, Generator)" },
    { code: "K", text: "Signalverarbeitung (Steuerung, Relais)" },
    { code: "M", text: "Antrieb (Motor)" },
    { code: "P", text: "Anzeige / Meldung" },
    { code: "Q", text: "Schalten von Energie- oder Stoffstrom (Schütz, Ventil)" },
    { code: "R", text: "Begrenzung (Widerstand, Drossel)" },
    { code: "S", text: "Bedienung (Taster, Schalter)" },
    { code: "T", text: "Umformung (Transformator, Frequenzumrichter)" },
    { code: "W", text: "Leitung / Übertragung" },
    { code: "X", text: "Verbindung (Klemme, Stecker)" },
    { code: "Y", text: "Magnetventil (klassische Kennzeichnung)" },
  ];

  const MERKMAL_TYPEN = [
    { code: "zahl", text: "Zahl" },
    { code: "text", text: "Text" },
    { code: "jaNein", text: "Ja/Nein" },
    { code: "auswahl", text: "Auswahlliste" },
  ];

  const SIGNAL_DATENTYPEN = ["Bool", "Int", "Word", "Real"];
  const SIGNAL_RICHTUNGEN = [
    { code: "E", text: "Eingang (Sensor -> Steuerung)" },
    { code: "A", text: "Ausgang (Steuerung -> Aktor)" },
  ];

  let idZaehler = 0;
  function neueId(prefix) {
    idZaehler += 1;
    return prefix + "-" + Date.now().toString(36) + "-" + idZaehler.toString(36) +
      "-" + Math.floor(Math.random() * 46656).toString(36);
  }

  function neuesElement(vorgabe) {
    return Object.assign({
      id: neueId("el"),
      name: "Neues Element",
      typ: "Station",
      elternId: null,
      kuerzel: "",          // Funktionskürzel für den =-Aspekt, z. B. "DOS"
      produktKlasse: "",    // nur Komponente: Buchstabe nach IEC 81346-2
      ort: "",              // Ortskennzeichen (+), wird nach unten vererbt
      verwendung: "standard", // "standard" | "option"
      bedingung: [],        // nur bei Option: [{merkmalId, op, wert}] (UND-verknüpft)
      merkmalwerte: {},     // { merkmalId: wert }
      signale: [],          // nur Komponente: [{id, name, richtung, datentyp}]
      kommentar: "",
    }, vorgabe || {});
  }

  function neuesMerkmal(vorgabe) {
    return Object.assign({
      id: neueId("mk"),
      name: "Neues Merkmal",
      typ: "text",          // zahl | text | jaNein | auswahl
      einheit: "",
      werte: [],            // nur bei auswahl
      istKonfiguration: false, // wird beim Konfigurieren einer Variante abgefragt
      standardwert: "",
      irdi: "",             // optional: stabiler Bezeichner, z. B. ECLASS-IRDI
      kommentar: "",
    }, vorgabe || {});
  }

  function neueRegel(vorgabe) {
    return Object.assign({
      id: neueId("rg"),
      name: "Neue Regel",
      aktiv: true,
      wenn: [],             // [{merkmalId, op, wert}] (UND-verknüpft)
      dann: [],             // [{art, elementId?, merkmalId?, wert?, stufe?, text?}]
      kommentar: "",
    }, vorgabe || {});
  }

  function neueKonfiguration(vorgabe) {
    return Object.assign({
      id: neueId("kf"),
      name: "Neue Konfiguration",
      antworten: {},        // { merkmalId: wert }
      kommentar: "",
    }, vorgabe || {});
  }

  function neuesSignal(vorgabe) {
    return Object.assign({
      id: neueId("sg"),
      name: "Signal",
      richtung: "E",
      datentyp: "Bool",
    }, vorgabe || {});
  }

  function neuesProjekt(name) {
    const wurzel = neuesElement({ name: name || "Neue Anlage", typ: "Anlage", kuerzel: "ANL" });
    return {
      schema: SCHEMA,
      projekt: { name: name || "Neue Anlage", beschreibung: "" },
      elemente: [wurzel],
      merkmale: [],
      regeln: [],
      konfigurationen: [],
      kennzeichnung: {
        trennerFunktion: ".",
        plcAdressenAutomatisch: true,
      },
    };
  }

  // ---- Baumfunktionen ------------------------------------------------------
  // Die Reihenfolge im Array `elemente` bestimmt die Geschwister-Reihenfolge
  // und damit auch die deterministische Nummerierung der Kennzeichen.

  function kinder(projekt, elternId) {
    return projekt.elemente.filter((e) => (e.elternId || null) === (elternId || null));
  }

  function findeElement(projekt, id) {
    return projekt.elemente.find((e) => e.id === id) || null;
  }

  function findeMerkmal(projekt, id) {
    return projekt.merkmale.find((m) => m.id === id) || null;
  }

  function findeRegel(projekt, id) {
    return projekt.regeln.find((r) => r.id === id) || null;
  }

  function findeKonfiguration(projekt, id) {
    return projekt.konfigurationen.find((k) => k.id === id) || null;
  }

  /** Elemente in Baumreihenfolge (Tiefensuche) als [{el, tiefe}]. */
  function elementeInBaumfolge(projekt) {
    const ergebnis = [];
    function absteigen(elternId, tiefe) {
      for (const kind of kinder(projekt, elternId)) {
        ergebnis.push({ el: kind, tiefe });
        absteigen(kind.id, tiefe + 1);
      }
    }
    absteigen(null, 0);
    return ergebnis;
  }

  /** Kette der Vorfahren von der Wurzel bis zum Element (einschließlich). */
  function elternKette(projekt, id) {
    const kette = [];
    let el = findeElement(projekt, id);
    let sicherung = 0;
    while (el && sicherung < 1000) {
      kette.unshift(el);
      el = el.elternId ? findeElement(projekt, el.elternId) : null;
      sicherung += 1;
    }
    return kette;
  }

  function istNachfahre(projekt, vorfahrId, id) {
    let el = findeElement(projekt, id);
    let sicherung = 0;
    while (el && el.elternId && sicherung < 1000) {
      if (el.elternId === vorfahrId) return true;
      el = findeElement(projekt, el.elternId);
      sicherung += 1;
    }
    return false;
  }

  /** Entfernt ein Element samt Unterbaum. Liefert Anzahl entfernter Elemente. */
  function entferneElement(projekt, id) {
    const zuEntfernen = new Set([id]);
    let gewachsen = true;
    while (gewachsen) {
      gewachsen = false;
      for (const e of projekt.elemente) {
        if (e.elternId && zuEntfernen.has(e.elternId) && !zuEntfernen.has(e.id)) {
          zuEntfernen.add(e.id);
          gewachsen = true;
        }
      }
    }
    projekt.elemente = projekt.elemente.filter((e) => !zuEntfernen.has(e.id));
    return zuEntfernen.size;
  }

  /** Verschiebt ein Element innerhalb seiner Geschwister um +1/-1 Position. */
  function verschiebeElement(projekt, id, richtung) {
    const el = findeElement(projekt, id);
    if (!el) return false;
    const geschwister = kinder(projekt, el.elternId);
    const pos = geschwister.findIndex((g) => g.id === id);
    const zielPos = pos + richtung;
    if (zielPos < 0 || zielPos >= geschwister.length) return false;
    const a = projekt.elemente.indexOf(geschwister[pos]);
    const b = projekt.elemente.indexOf(geschwister[zielPos]);
    projekt.elemente[a] = geschwister[zielPos];
    projekt.elemente[b] = geschwister[pos];
    return true;
  }

  function merkmalWertAlsText(merkmal, wert) {
    if (wert === undefined || wert === null || wert === "") return "";
    let text = String(wert);
    if (merkmal && merkmal.einheit) text += " " + merkmal.einheit;
    return text;
  }

  // ---- Prüfung / Import ----------------------------------------------------

  /** Konsistenzprüfung. Liefert [{stufe: "Fehler"|"Warnung", text, elementId?}]. */
  function validieren(projekt) {
    const befunde = [];
    const elementIds = new Set(projekt.elemente.map((e) => e.id));
    const merkmalIds = new Set(projekt.merkmale.map((m) => m.id));

    if (projekt.elemente.filter((e) => !e.elternId).length === 0) {
      befunde.push({ stufe: "Fehler", text: "Die Struktur hat kein Wurzelelement (z. B. eine Anlage)." });
    }

    for (const el of projekt.elemente) {
      if (el.elternId && !elementIds.has(el.elternId)) {
        befunde.push({ stufe: "Fehler", elementId: el.id, text: `„${el.name}“ verweist auf ein nicht vorhandenes übergeordnetes Element.` });
      }
      if (el.typ === "Komponente") {
        if (kinder(projekt, el.id).length > 0) {
          befunde.push({ stufe: "Fehler", elementId: el.id, text: `Die Komponente „${el.name}“ darf keine untergeordneten Elemente haben.` });
        }
        if (!el.produktKlasse) {
          befunde.push({ stufe: "Warnung", elementId: el.id, text: `Die Komponente „${el.name}“ hat keine Produktklasse – das Betriebsmittelkennzeichen bleibt unvollständig.` });
        }
      } else if (!el.kuerzel) {
        befunde.push({ stufe: "Warnung", elementId: el.id, text: `„${el.name}“ hat kein Funktionskürzel – für das Kennzeichen wird ein Kürzel aus dem Namen abgeleitet.` });
      }
      if (el.verwendung === "option" && (!el.bedingung || el.bedingung.length === 0)) {
        befunde.push({ stufe: "Warnung", elementId: el.id, text: `Die Option „${el.name}“ hat keine Bedingung – sie ist nur über eine Regel wählbar.` });
      }
      for (const b of el.bedingung || []) {
        if (!merkmalIds.has(b.merkmalId)) {
          befunde.push({ stufe: "Fehler", elementId: el.id, text: `Die Bedingung an „${el.name}“ verweist auf ein gelöschtes Merkmal.` });
        }
      }
      for (const mkId of Object.keys(el.merkmalwerte || {})) {
        if (!merkmalIds.has(mkId)) {
          befunde.push({ stufe: "Warnung", elementId: el.id, text: `„${el.name}“ trägt einen Wert für ein gelöschtes Merkmal.` });
        }
      }
    }

    const namen = {};
    for (const mk of projekt.merkmale) {
      namen[mk.name] = (namen[mk.name] || 0) + 1;
      if (mk.typ === "auswahl" && (!mk.werte || mk.werte.length === 0)) {
        befunde.push({ stufe: "Warnung", text: `Das Auswahl-Merkmal „${mk.name}“ hat keine Werteliste.` });
      }
    }
    for (const [name, anzahl] of Object.entries(namen)) {
      if (anzahl > 1) befunde.push({ stufe: "Warnung", text: `Der Merkmalname „${name}“ wird ${anzahl}-mal verwendet.` });
    }

    for (const regel of projekt.regeln) {
      for (const b of regel.wenn || []) {
        if (!merkmalIds.has(b.merkmalId)) {
          befunde.push({ stufe: "Fehler", text: `Die Regel „${regel.name}“ prüft ein gelöschtes Merkmal.` });
        }
      }
      for (const a of regel.dann || []) {
        if (a.elementId && !elementIds.has(a.elementId)) {
          befunde.push({ stufe: "Fehler", text: `Die Regel „${regel.name}“ verweist auf ein gelöschtes Element.` });
        }
        if (a.merkmalId && !merkmalIds.has(a.merkmalId)) {
          befunde.push({ stufe: "Fehler", text: `Die Regel „${regel.name}“ setzt ein gelöschtes Merkmal.` });
        }
      }
    }

    return befunde;
  }

  /**
   * Prüft importierte Projektdaten und ergänzt fehlende Vorgabefelder.
   * Wirft Error bei grob unpassenden Daten.
   */
  function pruefeProjekt(daten) {
    if (!daten || typeof daten !== "object") throw new Error("Die Datei enthält kein Projekt.");
    if (daten.schema !== SCHEMA) throw new Error(`Unbekanntes Dateiformat (erwartet „${SCHEMA}“).`);
    if (!Array.isArray(daten.elemente)) throw new Error("Die Datei enthält keine Strukturelemente.");
    const projekt = {
      schema: SCHEMA,
      projekt: Object.assign({ name: "Projekt", beschreibung: "" }, daten.projekt || {}),
      elemente: daten.elemente.map((e) => neuesElement(e)),
      merkmale: (daten.merkmale || []).map((m) => neuesMerkmal(m)),
      regeln: (daten.regeln || []).map((r) => neueRegel(r)),
      konfigurationen: (daten.konfigurationen || []).map((k) => neueKonfiguration(k)),
      kennzeichnung: Object.assign({ trennerFunktion: ".", plcAdressenAutomatisch: true }, daten.kennzeichnung || {}),
    };
    return projekt;
  }

  const api = {
    SCHEMA,
    ELEMENT_TYPEN,
    PRODUKT_KLASSEN,
    MERKMAL_TYPEN,
    SIGNAL_DATENTYPEN,
    SIGNAL_RICHTUNGEN,
    neueId,
    neuesProjekt,
    neuesElement,
    neuesMerkmal,
    neueRegel,
    neueKonfiguration,
    neuesSignal,
    kinder,
    findeElement,
    findeMerkmal,
    findeRegel,
    findeKonfiguration,
    elementeInBaumfolge,
    elternKette,
    istNachfahre,
    entferneElement,
    verschiebeElement,
    merkmalWertAlsText,
    validieren,
    pruefeProjekt,
  };

  ns.Model = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

})(typeof window !== "undefined" ? (window.SysM = window.SysM || {}) : {});
