"use strict";
/*
 * SysModeller – Übergabedaten.
 *
 * Alle Exporte werden aus demselben neutralen Datenmodell berechnet.
 * CSV-Dateien verwenden Semikolon und UTF-8 mit BOM (öffnet sauber in
 * deutschsprachigem Excel). Die PLC-Tag-Tabelle folgt dem Spaltenaufbau
 * des TIA-Portal-Imports (Komma-getrennt).
 */
(function (ns) {

  function dep(name, pfad) {
    if (ns[name]) return ns[name];
    return require(pfad);
  }

  function csvFeld(wert, trenner) {
    let s = wert === undefined || wert === null ? "" : String(wert);
    if (s.includes('"') || s.includes(trenner) || s.includes("\n") || s.includes("\r")) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function alsCsv(zeilen, trenner) {
    trenner = trenner || ";";
    return "\uFEFF" + zeilen.map((z) => z.map((f) => csvFeld(f, trenner)).join(trenner)).join("\r\n") + "\r\n";
  }

  function dateiName(projekt, zusatz, endung) {
    const Sysml = dep("Sysml", "./sysml.js");
    return Sysml.bezeichner(projekt.projekt.name) + "_" + zusatz + "." + endung;
  }

  /**
   * Strukturliste: die Anlagengliederung mit Kennzeichen.
   * `ergebnis` (optional) = Auswertung einer Konfiguration; ohne Ergebnis wird
   * die Maximalstruktur exportiert.
   */
  function strukturliste(projekt, kennzeichen, ergebnis) {
    const Model = dep("Model", "./model.js");
    const zeilen = [[
      "Ebene", "Kennzeichen (BMK)", "Name", "Typ", "Funktion (=)", "Ort (+)",
      "Betriebsmittel (-)", "Verwendung", "Enthalten", "Kommentar",
    ]];
    for (const { el, tiefe } of Model.elementeInBaumfolge(projekt)) {
      const kz = kennzeichen[el.id] || {};
      const status = ergebnis ? ergebnis.elementStatus[el.id] : null;
      zeilen.push([
        tiefe + 1,
        kz.bmk || "",
        el.name,
        el.typ,
        kz.funktion || "",
        kz.ort || "",
        kz.produkt || "",
        el.verwendung === "option" ? "Option" : "Standard",
        status ? (status.effektivEnthalten ? "ja" : "nein") : "ja (Maximalstruktur)",
        el.kommentar || "",
      ]);
    }
    return { dateiname: dateiName(projekt, "Strukturliste", "csv"), inhalt: alsCsv(zeilen), mime: "text/csv" };
  }

  /** Merkmalliste: jedes gesetzte Merkmal mit Wert, Einheit, Quelle, IRDI. */
  function merkmalliste(projekt, kennzeichen, ergebnis) {
    const Model = dep("Model", "./model.js");
    const Regeln = dep("Regeln", "./rules.js");
    const zeilen = [[
      "Kennzeichen (BMK)", "Element", "Merkmal", "Wert", "Einheit", "Typ", "Quelle", "IRDI",
    ]];

    // Anlagenweite Werte (Antworten, Standardwerte, Regelergebnisse).
    if (ergebnis) {
      for (const mk of projekt.merkmale) {
        const eintrag = ergebnis.werte[mk.id];
        if (!eintrag) continue;
        const quelle = eintrag.quelle.art === "Regel"
          ? `Regel „${eintrag.quelle.regelName}“`
          : eintrag.quelle.art;
        zeilen.push(["(Anlage gesamt)", projekt.projekt.name, mk.name, eintrag.wert, mk.einheit, mk.typ, quelle, mk.irdi]);
      }
    } else {
      for (const mk of projekt.merkmale) {
        if (mk.standardwert === "" || mk.standardwert === undefined) continue;
        zeilen.push(["(Anlage gesamt)", projekt.projekt.name, mk.name, mk.standardwert, mk.einheit, mk.typ, "Standardwert", mk.irdi]);
      }
    }

    // Werte an Elementen (statisch gepflegt oder per Regel gesetzt).
    for (const { el } of Model.elementeInBaumfolge(projekt)) {
      if (ergebnis && ergebnis.elementStatus[el.id] && !ergebnis.elementStatus[el.id].effektivEnthalten) continue;
      const kz = kennzeichen[el.id] || {};
      const merkmalIds = new Set(Object.keys(el.merkmalwerte || {}));
      if (ergebnis && ergebnis.elementWerte[el.id]) {
        for (const id of Object.keys(ergebnis.elementWerte[el.id])) merkmalIds.add(id);
      }
      for (const mkId of merkmalIds) {
        const mk = Model.findeMerkmal(projekt, mkId);
        if (!mk) continue;
        const eintrag = Regeln.elementWert(projekt, ergebnis, el.id, mkId);
        if (!eintrag) continue;
        zeilen.push([kz.bmk || "", el.name, mk.name, eintrag.wert, mk.einheit, mk.typ, eintrag.quelle, mk.irdi]);
      }
    }

    return { dateiname: dateiName(projekt, "Merkmalliste", "csv"), inhalt: alsCsv(zeilen), mime: "text/csv" };
  }

  /** BMK-Liste der Betriebsmittel (Komponenten) – z. B. für die E-Planung. */
  function bmkListe(projekt, kennzeichen, ergebnis) {
    const Model = dep("Model", "./model.js");
    const zeilen = [[
      "Kennzeichen (BMK)", "Funktion (=)", "Ort (+)", "Betriebsmittel (-)",
      "Name", "Produktklasse", "Enthalten",
    ]];
    for (const { el } of Model.elementeInBaumfolge(projekt)) {
      if (el.typ !== "Komponente") continue;
      const status = ergebnis ? ergebnis.elementStatus[el.id] : null;
      const kz = kennzeichen[el.id] || {};
      zeilen.push([
        kz.bmk || "",
        kz.funktion || "",
        kz.ort || "",
        kz.produkt || "",
        el.name,
        el.produktKlasse || "",
        status ? (status.effektivEnthalten ? "ja" : "nein") : "ja (Maximalstruktur)",
      ]);
    }
    return { dateiname: dateiName(projekt, "BMK_Liste", "csv"), inhalt: alsCsv(zeilen), mime: "text/csv" };
  }

  /** PLC-Tag-Tabelle im Spaltenaufbau des TIA-Portal-Imports. */
  function plcTagTabelle(projekt, tags) {
    const zeilen = [[
      "Name", "Path", "Data Type", "Logical Address", "Comment",
      "Hmi Visible", "Hmi Accessible", "Hmi Writeable",
    ]];
    for (const tag of tags) {
      zeilen.push([
        tag.name, "SysModeller", tag.datentyp, tag.adresse || "",
        tag.kommentar, "True", "True", "True",
      ]);
    }
    return { dateiname: dateiName(projekt, "PLC_Tags", "csv"), inhalt: alsCsv(zeilen, ","), mime: "text/csv" };
  }

  /** Das vollständige neutrale Datenmodell als JSON. */
  function projektJson(projekt) {
    return {
      dateiname: dateiName(projekt, "Projekt", "json"),
      inhalt: JSON.stringify(projekt, null, 2),
      mime: "application/json",
    };
  }

  /** Das formale Systemmodell (vereinfachte SysML-v2-Textnotation). */
  function sysmlModell(projekt) {
    const Sysml = dep("Sysml", "./sysml.js");
    return {
      dateiname: dateiName(projekt, "Systemmodell", "sysml"),
      inhalt: Sysml.erzeugeSysml(projekt),
      mime: "text/plain",
    };
  }

  const api = {
    alsCsv,
    strukturliste,
    merkmalliste,
    bmkListe,
    plcTagTabelle,
    projektJson,
    sysmlModell,
  };

  ns.Exporte = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

})(typeof window !== "undefined" ? (window.SysM = window.SysM || {}) : {});
