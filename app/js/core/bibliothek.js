"use strict";
/*
 * SysModeller – Firmenstandard-Bibliothek.
 *
 * Antwort auf das Wiederverwendungs-Problem: Ein Modul („Förderband Typ A“)
 * wird EINMAL definiert – mit Struktur (Mechanik), Komponenten und
 * Produktklassen (Elektrik), Signalen (Software) und Merkmalen (Vertrieb/
 * Auslegung). Jede Disziplin sieht denselben Schnitt, nur als andere
 * Projektion. Module sind versioniert; eingefügte Instanzen kennen ihre
 * Herkunft, und das Werkzeug erkennt Abweichungen vom Standard.
 *
 * Die Bibliothek lebt getrennt vom Projekt (sie gilt firmenweit) und ist
 * als einzelne Datei exportier-/importierbar.
 */
(function (ns) {

  function dep(name, pfad) {
    if (ns[name]) return ns[name];
    return require(pfad);
  }

  // ---- Normalform: Struktur ohne IDs, Merkmale über Namen referenziert ------

  function merkmalName(projekt, merkmalId) {
    const Model = dep("Model", "./model.js");
    const mk = Model.findeMerkmal(projekt, merkmalId);
    return mk ? mk.name : "?";
  }

  /** Element samt Unterbaum in eine vergleichbare, ID-freie Form bringen. */
  function normalisiereElement(projekt, el) {
    const Model = dep("Model", "./model.js");
    return {
      name: el.name,
      typ: el.typ,
      kuerzel: el.kuerzel || "",
      produktKlasse: el.produktKlasse || "",
      ort: el.ort || "",
      verwendung: el.verwendung === "option" ? "option" : "standard",
      bedingung: (el.bedingung || []).map((b) => ({
        merkmal: merkmalName(projekt, b.merkmalId), op: b.op, wert: b.wert,
      })),
      merkmalwerte: Object.entries(el.merkmalwerte || {})
        .map(([mkId, wert]) => ({ merkmal: merkmalName(projekt, mkId), wert }))
        .sort((a, b) => a.merkmal.localeCompare(b.merkmal)),
      signale: (el.signale || []).map((sig) => ({
        name: sig.name, richtung: sig.richtung, datentyp: sig.datentyp,
      })),
      kinder: Model.kinder(projekt, el.id).map((k) => normalisiereElement(projekt, k)),
    };
  }

  /** Alle im Unterbaum verwendeten Merkmal-IDs einsammeln. */
  function verwendeteMerkmale(projekt, el) {
    const Model = dep("Model", "./model.js");
    const ids = new Set();
    function absteigen(e) {
      for (const b of e.bedingung || []) ids.add(b.merkmalId);
      for (const mkId of Object.keys(e.merkmalwerte || {})) ids.add(mkId);
      for (const kind of Model.kinder(projekt, e.id)) absteigen(kind);
    }
    absteigen(el);
    return Array.from(ids)
      .map((id) => Model.findeMerkmal(projekt, id))
      .filter(Boolean);
  }

  // ---- Veröffentlichen -------------------------------------------------------

  /**
   * Erstellt aus einem Element (samt Unterbaum) ein Bibliotheksmodul.
   * meta: { name, version, beschreibung, stand }
   */
  function schnappschuss(projekt, elementId, meta) {
    const Model = dep("Model", "./model.js");
    const el = Model.findeElement(projekt, elementId);
    if (!el) return null;
    const wurzel = normalisiereElement(projekt, el);
    wurzel.name = meta.name || el.name;
    return {
      id: Model.neueId("md"),
      name: meta.name || el.name,
      version: meta.version || 1,
      beschreibung: meta.beschreibung || "",
      stand: meta.stand || "",
      wurzel,
      merkmale: verwendeteMerkmale(projekt, el).map((mk) => ({
        name: mk.name, typ: mk.typ, einheit: mk.einheit, werte: (mk.werte || []).slice(),
        min: mk.min || "", max: mk.max || "", istKonfiguration: !!mk.istKonfiguration,
        standardwert: mk.standardwert, irdi: mk.irdi || "", kommentar: mk.kommentar || "",
      })),
    };
  }

  // ---- Einfügen ---------------------------------------------------------------

  /**
   * Fügt ein Modul in das Projekt ein. Merkmale werden über IRDI (bevorzugt)
   * oder Namen wiedererkannt; fehlende Merkmale werden angelegt.
   * Liefert das eingefügte Wurzelelement.
   */
  function einfuegen(projekt, modul, elternId) {
    const Model = dep("Model", "./model.js");

    const merkmalIds = {}; // Merkmalname im Modul -> Merkmal-ID im Projekt
    for (const def of modul.merkmale || []) {
      let mk = def.irdi ? projekt.merkmale.find((m) => m.irdi === def.irdi) : null;
      if (!mk) mk = projekt.merkmale.find((m) => m.name === def.name);
      if (!mk) {
        mk = Model.neuesMerkmal(def);
        projekt.merkmale.push(mk);
      }
      merkmalIds[def.name] = mk.id;
    }

    function anlegen(knoten, eltern, istWurzel) {
      const el = Model.neuesElement({
        name: istWurzel ? Model.eindeutigerName(projekt, eltern, knoten.name) : knoten.name,
        typ: knoten.typ,
        elternId: eltern,
        kuerzel: knoten.kuerzel || "",
        produktKlasse: knoten.produktKlasse || "",
        ort: knoten.ort || "",
        verwendung: knoten.verwendung === "option" ? "option" : "standard",
        bedingung: (knoten.bedingung || [])
          .filter((b) => merkmalIds[b.merkmal])
          .map((b) => ({ merkmalId: merkmalIds[b.merkmal], op: b.op, wert: b.wert })),
        signale: (knoten.signale || []).map((sig) => Model.neuesSignal(sig)),
      });
      el.merkmalwerte = {};
      for (const eintrag of knoten.merkmalwerte || []) {
        if (merkmalIds[eintrag.merkmal]) el.merkmalwerte[merkmalIds[eintrag.merkmal]] = eintrag.wert;
      }
      if (istWurzel) {
        el.herkunft = { modulId: modul.id, name: modul.name, version: modul.version };
      }
      projekt.elemente.push(el);
      for (const kind of knoten.kinder || []) anlegen(kind, el.id, false);
      return el;
    }

    return anlegen(modul.wurzel, elternId || null, true);
  }

  // ---- Abweichungs-Prüfung ------------------------------------------------------

  /**
   * Vergleicht eine Instanz im Projekt mit ihrem Bibliotheksmodul.
   * Liefert { gleich, unterschiede: [Text] }. Der Name des Wurzelelements
   * darf abweichen (Instanzen werden nummeriert), Kommentare ebenfalls.
   */
  function vergleiche(projekt, elementId, modul) {
    const Model = dep("Model", "./model.js");
    const el = Model.findeElement(projekt, elementId);
    if (!el || !modul) return { gleich: false, unterschiede: ["Element oder Modul nicht gefunden."] };
    const ist = normalisiereElement(projekt, el);
    ist.name = modul.wurzel.name; // Instanzname darf abweichen
    const unterschiede = [];

    function vergleicheKnoten(a, b, pfad) {
      for (const feld of ["name", "typ", "kuerzel", "produktKlasse", "ort", "verwendung"]) {
        if (String(a[feld]) !== String(b[feld])) {
          unterschiede.push(`${pfad}: ${feld} ist „${a[feld]}“, Standard sagt „${b[feld]}“`);
        }
      }
      if (JSON.stringify(a.bedingung) !== JSON.stringify(b.bedingung)) {
        unterschiede.push(`${pfad}: Options-Bedingung weicht ab`);
      }
      if (JSON.stringify(a.merkmalwerte) !== JSON.stringify(b.merkmalwerte)) {
        unterschiede.push(`${pfad}: Merkmalwerte weichen ab`);
      }
      if (JSON.stringify(a.signale) !== JSON.stringify(b.signale)) {
        unterschiede.push(`${pfad}: Signale weichen ab`);
      }
      const anzahl = Math.max(a.kinder.length, b.kinder.length);
      if (a.kinder.length !== b.kinder.length) {
        unterschiede.push(`${pfad}: ${a.kinder.length} statt ${b.kinder.length} Unterelemente`);
      }
      for (let i = 0; i < anzahl; i += 1) {
        if (a.kinder[i] && b.kinder[i]) {
          vergleicheKnoten(a.kinder[i], b.kinder[i], pfad + " → " + a.kinder[i].name);
        }
      }
    }

    vergleicheKnoten(ist, modul.wurzel, el.name);
    return { gleich: unterschiede.length === 0, unterschiede };
  }

  /** Neueste Version je Modulname. */
  function neuesteVersionen(module) {
    const proName = new Map();
    for (const m of module || []) {
      const bisher = proName.get(m.name);
      if (!bisher || (m.version || 0) > (bisher.version || 0)) proName.set(m.name, m);
    }
    return Array.from(proName.values());
  }

  function findeModul(module, modulId) {
    return (module || []).find((m) => m.id === modulId) || null;
  }

  /** Startbestand: zwei Beispielstandards aus dem Baukasten. */
  function beispielModule(stand) {
    const Model = dep("Model", "./model.js");
    const Vorlagen = dep("Vorlagen", "./vorlagen.js");
    const projekt = Model.neuesProjekt("Vorlage");
    const wurzelId = projekt.elemente[0].id;
    const band = Vorlagen.instanziiere(projekt, "bg-foerderband", wurzelId);
    const schrank = Vorlagen.instanziiere(projekt, "st-steuerung", wurzelId);
    return [
      schnappschuss(projekt, band.id, {
        name: "Förderband Typ A", version: 1, stand: stand || "",
        beschreibung: "Freigegebenes Standard-Förderband: Bandmotor mit Freigabe/Störung, Lichtschranke am Einlauf.",
      }),
      schnappschuss(projekt, schrank.id, {
        name: "Schaltschrank Standard", version: 1, stand: stand || "",
        beschreibung: "Standard-Schaltschrank: SPS, Hauptschalter, Netzteil – Ort S1.",
      }),
    ];
  }

  const api = {
    normalisiereElement,
    schnappschuss,
    einfuegen,
    vergleiche,
    neuesteVersionen,
    findeModul,
    beispielModule,
  };

  ns.Bibliothek = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

})(typeof window !== "undefined" ? (window.SysM = window.SysM || {}) : {});
