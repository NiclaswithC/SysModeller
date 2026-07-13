"use strict";
/*
 * SysModeller – Regel- und Konfigurations-Engine.
 *
 * Grundgedanke: Die Struktur ist eine Maximalstruktur ("150 %-Modell").
 * Eine Konfiguration beantwortet die Konfigurationsmerkmale ("Fragen");
 * Bedingungen an Optionen und globale Regeln bestimmen daraus deterministisch,
 * welche Elemente enthalten sind und welche Werte sich ergeben ("100 %-Modell").
 *
 * Die Auswertung ist absichtlich einfach gehalten:
 *   - Bedingungen sind UND-verknüpfte Vergleiche (Merkmal <op> Wert).
 *   - Regeln werden in Listenreihenfolge angewendet, bis sich nichts mehr
 *     ändert (Fixpunkt, max. 20 Durchläufe). Bei Widerspruch wird das
 *     ehrlich gemeldet statt still entschieden.
 *   - Jeder Schritt landet im Protokoll (trace) – Nachvollziehbarkeit vor
 *     Funktionsumfang.
 */
(function (ns) {

  function dep(name, pfad) {
    if (ns[name]) return ns[name];
    return require(pfad);
  }

  const OPS = [
    { code: "=", text: "ist gleich" },
    { code: "!=", text: "ist ungleich" },
    { code: "<", text: "ist kleiner als" },
    { code: "<=", text: "ist höchstens" },
    { code: ">", text: "ist größer als" },
    { code: ">=", text: "ist mindestens" },
  ];

  const AKTIONS_ARTEN = [
    { code: "elementAufnehmen", text: "Element aufnehmen" },
    { code: "elementAusschliessen", text: "Element ausschließen" },
    { code: "wertSetzen", text: "Merkmalwert setzen" },
    { code: "meldung", text: "Meldung ausgeben" },
  ];

  const MELDUNG_STUFEN = ["Hinweis", "Warnung", "Fehler"];

  /** Zahl aus Text, deutsches Komma erlaubt. Liefert null wenn keine Zahl. */
  function parseZahl(wert) {
    if (typeof wert === "number") return isFinite(wert) ? wert : null;
    if (wert === undefined || wert === null) return null;
    const text = String(wert).trim().replace(",", ".");
    if (text === "") return null;
    const zahl = parseFloat(text);
    return isNaN(zahl) ? null : zahl;
  }

  function vergleiche(op, istWert, sollWert) {
    if (istWert === undefined || istWert === null || istWert === "") return false;
    const a = String(istWert).trim();
    const b = String(sollWert === undefined || sollWert === null ? "" : sollWert).trim();
    if (op === "=" || op === "!=") {
      const an = parseZahl(a);
      const bn = parseZahl(b);
      // Vollständig numerische Angaben numerisch vergleichen ("60" == "60,0"),
      // alles andere als Text.
      const gleich = (an !== null && bn !== null && /^[-+0-9.,\s]+$/.test(a) && /^[-+0-9.,\s]+$/.test(b))
        ? an === bn
        : a === b;
      return op === "=" ? gleich : !gleich;
    }
    const an = parseZahl(a);
    const bn = parseZahl(b);
    if (an === null || bn === null) return false;
    switch (op) {
      case "<": return an < bn;
      case "<=": return an <= bn;
      case ">": return an > bn;
      case ">=": return an >= bn;
      default: return false;
    }
  }

  /** Prüft eine einzelne Bedingung gegen die aktuellen Werte. */
  function pruefeBedingung(bedingung, werte) {
    const eintrag = werte[bedingung.merkmalId];
    const istWert = eintrag ? eintrag.wert : undefined;
    return vergleiche(bedingung.op, istWert, bedingung.wert);
  }

  function pruefeBedingungen(bedingungen, werte) {
    return (bedingungen || []).every((b) => pruefeBedingung(b, werte));
  }

  // ---- Beschreibungen (für Oberfläche und Protokoll) -----------------------

  function opText(op) {
    const eintrag = OPS.find((o) => o.code === op);
    return eintrag ? eintrag.text : op;
  }

  function beschreibeBedingung(bedingung, projekt) {
    const Model = dep("Model", "./model.js");
    const mk = Model.findeMerkmal(projekt, bedingung.merkmalId);
    const name = mk ? mk.name : "(gelöschtes Merkmal)";
    const wert = mk ? Model.merkmalWertAlsText(mk, bedingung.wert) : String(bedingung.wert);
    return `${name} ${opText(bedingung.op)} ${wert}`;
  }

  function beschreibeBedingungen(bedingungen, projekt) {
    return (bedingungen || []).map((b) => beschreibeBedingung(b, projekt)).join(" UND ");
  }

  function beschreibeAktion(aktion, projekt) {
    const Model = dep("Model", "./model.js");
    switch (aktion.art) {
      case "elementAufnehmen": {
        const el = Model.findeElement(projekt, aktion.elementId);
        return `nimm „${el ? el.name : "?"}“ auf`;
      }
      case "elementAusschliessen": {
        const el = Model.findeElement(projekt, aktion.elementId);
        return `schließe „${el ? el.name : "?"}“ aus`;
      }
      case "wertSetzen": {
        const mk = Model.findeMerkmal(projekt, aktion.merkmalId);
        const ziel = aktion.elementId ? Model.findeElement(projekt, aktion.elementId) : null;
        const wert = mk ? Model.merkmalWertAlsText(mk, aktion.wert) : String(aktion.wert);
        return ziel
          ? `setze an „${ziel.name}“: ${mk ? mk.name : "?"} = ${wert}`
          : `setze ${mk ? mk.name : "?"} = ${wert}`;
      }
      case "meldung":
        return `melde (${aktion.stufe || "Hinweis"}): ${aktion.text || ""}`;
      default:
        return aktion.art;
    }
  }

  function beschreibeRegel(regel, projekt) {
    const wenn = beschreibeBedingungen(regel.wenn, projekt) || "(immer)";
    const dann = (regel.dann || []).map((a) => beschreibeAktion(a, projekt)).join("; ") || "(keine Aktion)";
    return `WENN ${wenn} DANN ${dann}`;
  }

  // ---- Auswertung ----------------------------------------------------------

  const MAX_DURCHLAEUFE = 20;

  /**
   * Wertet Projekt + Antworten aus.
   *
   * Liefert:
   * {
   *   werte:        { merkmalId: { wert, quelle: {art, regelId?, regelName?} } },
   *   elementWerte: { elementId: { merkmalId: { wert, regelId } } },
   *   elementStatus:{ elementId: { enthalten, effektivEnthalten, grund } },
   *   meldungen:    [{ stufe, text, regelId? }],
   *   trace:        [{ durchlauf?, text }],
   *   konvergiert:  bool
   * }
   */
  function auswerten(projekt, antworten) {
    const Model = dep("Model", "./model.js");
    antworten = antworten || {};
    const trace = [];
    const meldungen = [];
    const meldungSchluessel = new Set();

    // 1. Ausgangswerte: Antworten der Konfiguration, sonst Standardwerte.
    const werte = {};
    for (const mk of projekt.merkmale) {
      const antwort = antworten[mk.id];
      if (mk.istKonfiguration && antwort !== undefined && antwort !== null && antwort !== "") {
        werte[mk.id] = { wert: antwort, quelle: { art: "Antwort" } };
      } else if (mk.standardwert !== undefined && mk.standardwert !== null && mk.standardwert !== "") {
        werte[mk.id] = { wert: mk.standardwert, quelle: { art: "Standardwert" } };
      }
    }
    for (const mk of projekt.merkmale) {
      if (mk.istKonfiguration) {
        const eintrag = werte[mk.id];
        trace.push({
          text: eintrag
            ? `Frage „${mk.name}“: ${Model.merkmalWertAlsText(mk, eintrag.wert)} (${eintrag.quelle.art})`
            : `Frage „${mk.name}“: nicht beantwortet, kein Standardwert`,
        });
      }
    }

    // 2. Regeln bis zum Fixpunkt anwenden.
    const elementWerte = {};
    const regelOverrides = {}; // elementId -> { enthalten, regelId, regelName }
    const aktiveRegeln = projekt.regeln.filter((r) => r.aktiv !== false);
    let durchlauf = 0;
    let stabil = false;
    while (!stabil && durchlauf < MAX_DURCHLAEUFE) {
      durchlauf += 1;
      stabil = true;
      for (const regel of aktiveRegeln) {
        if (!pruefeBedingungen(regel.wenn, werte)) continue;
        for (const aktion of regel.dann || []) {
          switch (aktion.art) {
            case "wertSetzen": {
              if (aktion.elementId) {
                const proElement = elementWerte[aktion.elementId] || (elementWerte[aktion.elementId] = {});
                const alt = proElement[aktion.merkmalId];
                if (!alt || alt.wert !== aktion.wert) {
                  proElement[aktion.merkmalId] = { wert: aktion.wert, regelId: regel.id };
                  stabil = false;
                  trace.push({ durchlauf, text: `Regel „${regel.name}“: ${beschreibeAktion(aktion, projekt)}` });
                }
              } else {
                const alt = werte[aktion.merkmalId];
                if (!alt || alt.wert !== aktion.wert) {
                  werte[aktion.merkmalId] = {
                    wert: aktion.wert,
                    quelle: { art: "Regel", regelId: regel.id, regelName: regel.name },
                  };
                  stabil = false;
                  trace.push({ durchlauf, text: `Regel „${regel.name}“: ${beschreibeAktion(aktion, projekt)}` });
                }
              }
              break;
            }
            case "elementAufnehmen":
            case "elementAusschliessen": {
              const soll = aktion.art === "elementAufnehmen";
              const alt = regelOverrides[aktion.elementId];
              if (!alt || alt.enthalten !== soll) {
                regelOverrides[aktion.elementId] = { enthalten: soll, regelId: regel.id, regelName: regel.name };
                stabil = false;
                trace.push({ durchlauf, text: `Regel „${regel.name}“: ${beschreibeAktion(aktion, projekt)}` });
              }
              break;
            }
            case "meldung": {
              const schluessel = regel.id + "|" + (aktion.text || "");
              if (!meldungSchluessel.has(schluessel)) {
                meldungSchluessel.add(schluessel);
                meldungen.push({ stufe: aktion.stufe || "Hinweis", text: aktion.text || "", regelId: regel.id });
                trace.push({ durchlauf, text: `Regel „${regel.name}“: ${beschreibeAktion(aktion, projekt)}` });
              }
              break;
            }
            default:
              break;
          }
        }
      }
    }
    const konvergiert = stabil;
    if (!konvergiert) {
      meldungen.push({
        stufe: "Fehler",
        text: "Die Regeln widersprechen sich: Auch nach " + MAX_DURCHLAEUFE +
          " Durchläufen ändert sich das Ergebnis noch. Bitte Regeln prüfen (siehe Protokoll).",
      });
    }

    // 3. Enthaltensein je Element bestimmen.
    //    Vorrang: Regel-Eingriff > eigene Bedingung > Verwendung (Standard/Option).
    const elementStatus = {};
    for (const el of projekt.elemente) {
      let enthalten;
      let grund;
      const override = regelOverrides[el.id];
      if (override) {
        enthalten = override.enthalten;
        grund = `${enthalten ? "Aufgenommen" : "Ausgeschlossen"} durch Regel „${override.regelName}“`;
      } else if (el.verwendung === "option") {
        if (el.bedingung && el.bedingung.length > 0) {
          enthalten = pruefeBedingungen(el.bedingung, werte);
          grund = `Option, Bedingung „${beschreibeBedingungen(el.bedingung, projekt)}“ ist ${enthalten ? "erfüllt" : "nicht erfüllt"}`;
        } else {
          enthalten = false;
          grund = "Option ohne Bedingung – nur über eine Regel wählbar";
        }
      } else {
        enthalten = true;
        grund = "Standardumfang";
      }
      elementStatus[el.id] = { enthalten, effektivEnthalten: enthalten, grund };
    }

    // 4. Wirksames Enthaltensein: ohne den übergeordneten Zweig kein Element.
    for (const { el } of Model.elementeInBaumfolge(projekt)) {
      const status = elementStatus[el.id];
      if (!el.elternId) continue;
      const elternStatus = elementStatus[el.elternId];
      if (elternStatus && !elternStatus.effektivEnthalten) {
        status.effektivEnthalten = false;
        if (status.enthalten) {
          const eltern = Model.findeElement(projekt, el.elternId);
          status.grund += ` – entfällt, weil „${eltern ? eltern.name : "?"}“ nicht enthalten ist`;
        }
      } else {
        status.effektivEnthalten = status.enthalten;
      }
      if (el.verwendung === "option" || regelOverrides[el.id]) {
        trace.push({ text: `Element „${el.name}“: ${status.effektivEnthalten ? "enthalten" : "nicht enthalten"} (${status.grund})` });
      }
    }

    return { werte, elementWerte, elementStatus, meldungen, trace, konvergiert };
  }

  /** Wirksamer Merkmalwert eines Elements: Regelwert vor statischem Wert. */
  function elementWert(projekt, ergebnis, elementId, merkmalId) {
    if (ergebnis && ergebnis.elementWerte[elementId] && ergebnis.elementWerte[elementId][merkmalId] !== undefined) {
      return { wert: ergebnis.elementWerte[elementId][merkmalId].wert, quelle: "Regel" };
    }
    const el = (ns.Model || dep("Model", "./model.js")).findeElement(projekt, elementId);
    if (el && el.merkmalwerte && el.merkmalwerte[merkmalId] !== undefined && el.merkmalwerte[merkmalId] !== "") {
      return { wert: el.merkmalwerte[merkmalId], quelle: "Struktur" };
    }
    return null;
  }

  const api = {
    OPS,
    AKTIONS_ARTEN,
    MELDUNG_STUFEN,
    parseZahl,
    vergleiche,
    pruefeBedingung,
    pruefeBedingungen,
    beschreibeBedingung,
    beschreibeBedingungen,
    beschreibeAktion,
    beschreibeRegel,
    auswerten,
    elementWert,
  };

  ns.Regeln = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

})(typeof window !== "undefined" ? (window.SysM = window.SysM || {}) : {});
