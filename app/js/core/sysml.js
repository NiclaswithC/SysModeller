"use strict";
/*
 * SysModeller – Export des formalen Systemmodells (vereinfachte
 * SysML-v2-Textnotation).
 *
 * Die Oberfläche verwendet bewusst kein SysML-Vokabular. Dieser Export macht
 * die im Hintergrund vorhandene formale Abbildung sichtbar:
 *
 *   Strukturelement       -> part (verschachtelt), Elementtyp -> part def
 *   Merkmal               -> attribute def   (Definition, vgl. ECLASS)
 *   Merkmalwert           -> attribute       (Verwendung mit Wert)
 *   Option + Bedingung    -> variation / Kommentar
 *   Regel                 -> constraint def mit dokumentierter WENN/DANN-Logik
 *
 * Details in docs/datenmodell.md.
 */
(function (ns) {

  function dep(name, pfad) {
    if (ns[name]) return ns[name];
    return require(pfad);
  }

  function bezeichner(text) {
    let t = String(text || "")
      .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^A-Za-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    if (/^[0-9]/.test(t)) t = "_" + t;
    return t || "Unbenannt";
  }

  function klein(text) {
    const t = bezeichner(text);
    return t.charAt(0).toLowerCase() + t.slice(1);
  }

  function sysmlTyp(merkmalTyp) {
    switch (merkmalTyp) {
      case "zahl": return "Real";
      case "jaNein": return "Boolean";
      default: return "String";
    }
  }

  function sysmlWert(merkmal, wert) {
    if (merkmal.typ === "zahl") {
      const Regeln = dep("Regeln", "./rules.js");
      const zahl = Regeln.parseZahl(wert);
      return zahl === null ? JSON.stringify(String(wert)) : String(zahl);
    }
    if (merkmal.typ === "jaNein") return String(wert).trim() === "ja" ? "true" : "false";
    return JSON.stringify(String(wert));
  }

  /** Erzeugt den Text des formalen Modells. */
  function erzeugeSysml(projekt) {
    const Model = dep("Model", "./model.js");
    const Regeln = dep("Regeln", "./rules.js");
    const Kennzeichnung = dep("Kennzeichnung", "./labeling.js");
    const kennzeichen = Kennzeichnung.berechneKennzeichen(projekt);

    const z = [];
    z.push("// Generiert von SysModeller – vereinfachte SysML-v2-Textnotation.");
    z.push("// Struktur, Merkmale, Varianten und Regeln der Maschinenbeschreibung");
    z.push("// als formales Systemmodell. Erzeugt aus dem neutralen Datenmodell.");
    z.push(`package ${bezeichner(projekt.projekt.name)} {`);
    z.push("");
    z.push("    import ScalarValues::*;");
    z.push("");

    // Merkmale: Definition getrennt vom Wert (vgl. ECLASS Merkmal/IRDI).
    if (projekt.merkmale.length) {
      z.push("    // Merkmalsdefinitionen (Merkmal getrennt vom Merkmalwert)");
      for (const mk of projekt.merkmale) {
        const doku = [];
        if (mk.einheit) doku.push("Einheit: " + mk.einheit);
        if (mk.typ === "auswahl" && mk.werte.length) doku.push("Werte: " + mk.werte.join(" | "));
        if (mk.istKonfiguration) doku.push("Konfigurationsmerkmal");
        if (mk.irdi) doku.push("IRDI: " + mk.irdi);
        z.push(`    attribute def ${bezeichner(mk.name)} :> ${sysmlTyp(mk.typ)};` +
          (doku.length ? ` // ${doku.join("; ")}` : ""));
      }
      z.push("");
    }

    // Elementtypen als part defs.
    const typen = Array.from(new Set(projekt.elemente.map((e) => e.typ)));
    z.push("    // Ebenen der Anlagengliederung (vgl. ISA-88)");
    for (const typ of typen) z.push(`    part def ${bezeichner(typ)};`);
    z.push("");

    // Struktur als verschachtelte parts.
    function elementBlock(el, einzug) {
      const pre = "    ".repeat(einzug);
      const kz = kennzeichen[el.id];
      const kinder = Model.kinder(projekt, el.id);
      const kopf = `${pre}part ${klein(el.name)} : ${bezeichner(el.typ)} {`;
      z.push(kopf);
      if (kz && kz.bmk) z.push(`${pre}    // Kennzeichen: ${kz.bmk}`);
      if (el.verwendung === "option") {
        const bed = el.bedingung && el.bedingung.length
          ? Regeln.beschreibeBedingungen(el.bedingung, projekt)
          : "per Regel wählbar";
        z.push(`${pre}    // variation – Option, enthalten wenn: ${bed}`);
      }
      for (const [mkId, wert] of Object.entries(el.merkmalwerte || {})) {
        const mk = Model.findeMerkmal(projekt, mkId);
        if (!mk || wert === "" || wert === undefined || wert === null) continue;
        z.push(`${pre}    attribute ${klein(mk.name)} : ${bezeichner(mk.name)} = ${sysmlWert(mk, wert)};`);
      }
      for (const signal of el.signale || []) {
        z.push(`${pre}    port ${klein(signal.name)}; // ${signal.richtung === "A" ? "Ausgang" : "Eingang"}, ${signal.datentyp}`);
      }
      for (const kind of kinder) elementBlock(kind, einzug + 1);
      z.push(`${pre}}`);
    }
    z.push("    // Anlagenstruktur (Maximalstruktur mit allen Optionen)");
    for (const wurzel of projekt.elemente.filter((e) => !e.elternId)) {
      elementBlock(wurzel, 1);
    }
    z.push("");

    // Globale Konfigurationsmerkmale.
    const konfigMerkmale = projekt.merkmale.filter((m) => m.istKonfiguration);
    if (konfigMerkmale.length) {
      z.push("    // Konfigurationsmerkmale (die „Fragen“ einer Variante)");
      for (const mk of konfigMerkmale) {
        z.push(`    attribute ${klein(mk.name)} : ${bezeichner(mk.name)};`);
      }
      z.push("");
    }

    // Regeln als constraints.
    if (projekt.regeln.length) {
      z.push("    // Regeln (Varianten- und Konsistenzlogik)");
      for (const regel of projekt.regeln) {
        z.push(`    constraint def ${bezeichner(regel.name)} {`);
        z.push(`        doc /* ${Regeln.beschreibeRegel(regel, projekt)}${regel.aktiv === false ? " (inaktiv)" : ""} */`);
        z.push("    }");
      }
      z.push("");
    }

    // Konfigurationen als Kommentarblock.
    if (projekt.konfigurationen.length) {
      z.push("    // Definierte Varianten (Konfigurationen)");
      for (const konfig of projekt.konfigurationen) {
        const antworten = Object.entries(konfig.antworten || {}).map(([mkId, wert]) => {
          const mk = Model.findeMerkmal(projekt, mkId);
          return `${mk ? mk.name : "?"} = ${wert}`;
        });
        z.push(`    // ${konfig.name}: ${antworten.join(", ") || "(alle Standardwerte)"}`);
      }
    }

    z.push("}");
    z.push("");
    return z.join("\n");
  }

  const api = { erzeugeSysml, bezeichner };

  ns.Sysml = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

})(typeof window !== "undefined" ? (window.SysM = window.SysM || {}) : {});
