"use strict";
/*
 * SysModeller – Kennzeichnung: BMK und PLC-Tags.
 *
 * Kennzeichen werden vollständig aus der Struktur berechnet, nichts wird von
 * Hand vergeben. Aufbau nach den Aspekten der IEC 81346:
 *   =  Funktion   -> Pfad der Funktionskürzel durch die Struktur (=ABF.DOS1)
 *   +  Ort        -> Ortskennzeichen, wird nach unten vererbt      (+F1)
 *   -  Produkt    -> Produktklasse + laufende Nummer je Komponente (-M2)
 *
 * Wichtig für Konsistenz über Varianten hinweg: Nummerierung wird immer auf
 * der Maximalstruktur berechnet. Entfällt ein Element in einer Variante,
 * behalten alle übrigen ihr Kennzeichen (keine Umnummerierung).
 */
(function (ns) {

  function dep(name, pfad) {
    if (ns[name]) return ns[name];
    return require(pfad);
  }

  /** Ersatz-Funktionskürzel aus dem Namen, falls keines gepflegt ist. */
  function autoKuerzel(name) {
    const bereinigt = String(name || "")
      .replace(/ä/gi, "AE").replace(/ö/gi, "OE").replace(/ü/gi, "UE").replace(/ß/gi, "SS")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return bereinigt.slice(0, 3) || "X";
  }

  /** Tag-Namen bereinigen: Umlaute ersetzen, Sonderzeichen zu Unterstrich. */
  function bereinigeTagName(text) {
    let t = String(text || "")
      .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^A-Za-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    if (/^[0-9]/.test(t)) t = "T" + t;
    return t || "Tag";
  }

  /**
   * Berechnet alle Kennzeichen auf der Maximalstruktur.
   * Liefert { elementId: { funktionsPfad: [..], funktion, ort, produkt, bmk } }.
   */
  function berechneKennzeichen(projekt) {
    const Model = dep("Model", "./model.js");
    const trenner = (projekt.kennzeichnung && projekt.kennzeichnung.trennerFunktion) || ".";
    const ergebnis = {};
    const produktZaehler = {}; // "scopeId|klasse" -> letzte Nummer

    function absteigen(elternId, pfad, ortGeerbt, scopeId) {
      const geschwister = Model.kinder(projekt, elternId);

      // Funktionscodes der Geschwister bestimmen; gleiche Kürzel werden
      // deterministisch nach Reihenfolge nummeriert (DOS1, DOS2, ...).
      const codes = {};
      const haeufigkeit = {};
      for (const el of geschwister) {
        if (el.typ === "Komponente") continue;
        const basis = el.kuerzel ? String(el.kuerzel).toUpperCase() : autoKuerzel(el.name);
        haeufigkeit[basis] = (haeufigkeit[basis] || 0) + 1;
      }
      const laufend = {};
      for (const el of geschwister) {
        if (el.typ === "Komponente") continue;
        const basis = el.kuerzel ? String(el.kuerzel).toUpperCase() : autoKuerzel(el.name);
        laufend[basis] = (laufend[basis] || 0) + 1;
        codes[el.id] = haeufigkeit[basis] > 1 ? basis + laufend[basis] : basis;
      }

      for (const el of geschwister) {
        const ort = el.ort ? String(el.ort) : ortGeerbt;
        if (el.typ === "Komponente") {
          const klasse = (el.produktKlasse || "").toUpperCase();
          let produkt = "";
          if (klasse) {
            const schluessel = (scopeId || "wurzel") + "|" + klasse;
            produktZaehler[schluessel] = (produktZaehler[schluessel] || 0) + 1;
            produkt = klasse + produktZaehler[schluessel];
          }
          const funktion = pfad.length ? "=" + pfad.join(trenner) : "";
          ergebnis[el.id] = {
            funktionsPfad: pfad.slice(),
            funktion,
            ort: ort ? "+" + ort : "",
            produkt: produkt ? "-" + produkt : "",
            produktCode: produkt,
            bmk: funktion + (ort ? "+" + ort : "") + (produkt ? "-" + produkt : ""),
          };
          // Komponenten unterhalb von Komponenten sind unzulässig; die
          // Validierung meldet das. Hier nicht weiter absteigen.
        } else {
          const neuerPfad = pfad.concat(codes[el.id]);
          const funktion = "=" + neuerPfad.join(trenner);
          ergebnis[el.id] = {
            funktionsPfad: neuerPfad,
            funktion,
            ort: ort ? "+" + ort : "",
            produkt: "",
            produktCode: "",
            bmk: funktion + (ort ? "+" + ort : ""),
          };
          absteigen(el.id, neuerPfad, ort, el.id);
        }
      }
    }

    absteigen(null, [], "", null);
    return ergebnis;
  }

  /**
   * PLC-Tag-Liste aus der Struktur (deterministisch in Baumreihenfolge).
   * `elementStatus` ist optional: mit Status nur die enthaltenen Komponenten,
   * ohne Status die Maximalstruktur.
   */
  function plcTags(projekt, kennzeichen, elementStatus) {
    const Model = dep("Model", "./model.js");
    const tags = [];
    for (const { el } of Model.elementeInBaumfolge(projekt)) {
      if (el.typ !== "Komponente") continue;
      if (elementStatus && elementStatus[el.id] && !elementStatus[el.id].effektivEnthalten) continue;
      const kz = kennzeichen[el.id] || { funktionsPfad: [], produktCode: "", bmk: "" };
      for (const signal of el.signale || []) {
        const teile = kz.funktionsPfad.concat(kz.produktCode || bereinigeTagName(el.name), signal.name);
        tags.push({
          elementId: el.id,
          signalId: signal.id,
          name: bereinigeTagName(teile.join("_")),
          datentyp: signal.datentyp || "Bool",
          richtung: signal.richtung || "E",
          adresse: "",
          bmk: kz.bmk,
          kommentar: `${el.name} – ${signal.name}` + (kz.bmk ? ` (${kz.bmk})` : ""),
        });
      }
    }
    if (projekt.kennzeichnung && projekt.kennzeichnung.plcAdressenAutomatisch) {
      vergebeAdressen(tags);
    }
    return tags;
  }

  /**
   * Deterministische Adressvergabe: Eingänge %I, Ausgänge %Q, in Listenfolge.
   * Bool bitweise, Int/Word wortweise (2 Byte), Real doppelwortweise (4 Byte,
   * ausgerichtet).
   */
  function vergebeAdressen(tags) {
    const groesse = { Int: 2, Word: 2, Real: 4 };
    const zaehler = { E: { byte: 0, bit: 0 }, A: { byte: 0, bit: 0 } };
    for (const tag of tags) {
      const richtung = tag.richtung === "A" ? "A" : "E";
      const z = zaehler[richtung];
      const kennbuchstabe = richtung === "A" ? "Q" : "I";
      if (tag.datentyp === "Bool") {
        tag.adresse = `%${kennbuchstabe}${z.byte}.${z.bit}`;
        z.bit += 1;
        if (z.bit > 7) { z.bit = 0; z.byte += 1; }
      } else {
        if (z.bit > 0) { z.bit = 0; z.byte += 1; }
        const g = groesse[tag.datentyp] || 2;
        if (z.byte % g !== 0) z.byte += g - (z.byte % g);
        tag.adresse = `%${kennbuchstabe}${g === 4 ? "D" : "W"}${z.byte}`;
        z.byte += g;
      }
    }
    return tags;
  }

  /** Prüft auf doppelte BMK und doppelte Tag-Namen. */
  function pruefeKonflikte(projekt, kennzeichen, tags) {
    const Model = dep("Model", "./model.js");
    const befunde = [];

    const bmkVorkommen = {};
    for (const el of projekt.elemente) {
      const kz = kennzeichen[el.id];
      if (!kz || !kz.bmk) continue;
      (bmkVorkommen[kz.bmk] = bmkVorkommen[kz.bmk] || []).push(el);
    }
    for (const [bmk, elemente] of Object.entries(bmkVorkommen)) {
      if (elemente.length > 1) {
        befunde.push({
          stufe: "Warnung",
          text: `Das Kennzeichen ${bmk} ist ${elemente.length}-mal vergeben: ` +
            elemente.map((e) => `„${e.name}“`).join(", ") + ".",
        });
      }
    }

    const tagVorkommen = {};
    for (const tag of tags || []) {
      (tagVorkommen[tag.name] = tagVorkommen[tag.name] || []).push(tag);
    }
    for (const [name, liste] of Object.entries(tagVorkommen)) {
      if (liste.length > 1) {
        const namen = liste.map((t) => {
          const el = Model.findeElement(projekt, t.elementId);
          return el ? `„${el.name}“` : "?";
        });
        befunde.push({ stufe: "Warnung", text: `Der PLC-Tag ${name} ist ${liste.length}-mal vergeben (${namen.join(", ")}).` });
      }
    }

    return befunde;
  }

  const api = {
    autoKuerzel,
    bereinigeTagName,
    berechneKennzeichen,
    plcTags,
    vergebeAdressen,
    pruefeKonflikte,
  };

  ns.Kennzeichnung = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

})(typeof window !== "undefined" ? (window.SysM = window.SysM || {}) : {});
