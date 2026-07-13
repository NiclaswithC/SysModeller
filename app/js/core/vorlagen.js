"use strict";
/*
 * SysModeller – Baukasten: vorkonfigurierte Bausteine.
 *
 * Statt leerer Formulare fügt der Anwender fertige Bausteine ein: eine
 * Station, ein Förderband, einen Motor. Kürzel, Produktklasse und typische
 * Signale sind bereits gesetzt – anpassen ist erlaubt, nötig ist es selten.
 * Baugruppen-Vorlagen bringen ihre Komponenten gleich mit.
 */
(function (ns) {

  function dep(name, pfad) {
    if (ns[name]) return ns[name];
    return require(pfad);
  }

  function s(name, richtung, datentyp) {
    return { name, richtung, datentyp: datentyp || "Bool" };
  }

  const GRUPPEN = [
    {
      titel: "Stationen",
      hinweis: "Grobe Abschnitte der Maschine – werden nebeneinander zur Linie.",
      eintraege: [
        { id: "st-zufuehrung", name: "Zuführung", typ: "Station", kuerzel: "ZUF" },
        { id: "st-dosier", name: "Dosierstation", typ: "Station", kuerzel: "DOS" },
        { id: "st-montage", name: "Montagestation", typ: "Station", kuerzel: "MON" },
        { id: "st-pruef", name: "Prüfstation", typ: "Station", kuerzel: "PRF" },
        { id: "st-verschluss", name: "Verschließstation", typ: "Station", kuerzel: "VER" },
        { id: "st-etikett", name: "Etikettierer", typ: "Station", kuerzel: "ETI" },
        { id: "st-verpackung", name: "Verpackungsstation", typ: "Station", kuerzel: "VPK" },
        { id: "st-roboter", name: "Roboterzelle", typ: "Station", kuerzel: "ROB" },
        {
          id: "st-steuerung", name: "Schaltschrank", typ: "Station", kuerzel: "STG", ort: "S1",
          kinder: [
            { name: "SPS", typ: "Komponente", produktKlasse: "K" },
            { name: "Hauptschalter", typ: "Komponente", produktKlasse: "Q", signale: [s("Eingeschaltet", "E")] },
            { name: "Netzteil", typ: "Komponente", produktKlasse: "G" },
          ],
        },
      ],
    },
    {
      titel: "Baugruppen",
      hinweis: "Fertige Einheiten samt Komponenten und Signalen.",
      eintraege: [
        {
          id: "bg-foerderband", name: "Förderband", typ: "Baugruppe", kuerzel: "TRB",
          kinder: [
            { name: "Bandmotor", typ: "Komponente", produktKlasse: "M", signale: [s("Freigabe", "A"), s("Störung", "E")] },
            { name: "Lichtschranke", typ: "Komponente", produktKlasse: "B", signale: [s("Belegt", "E")] },
          ],
        },
        {
          id: "bg-hubeinheit", name: "Hubeinheit", typ: "Baugruppe", kuerzel: "HUB",
          kinder: [
            { name: "Hubventil", typ: "Komponente", produktKlasse: "Q", signale: [s("Heben", "A"), s("Senken", "A")] },
            { name: "Endlage oben", typ: "Komponente", produktKlasse: "B", signale: [s("Erreicht", "E")] },
            { name: "Endlage unten", typ: "Komponente", produktKlasse: "B", signale: [s("Erreicht", "E")] },
          ],
        },
        {
          id: "bg-drehtisch", name: "Drehtisch", typ: "Baugruppe", kuerzel: "DRE",
          kinder: [
            { name: "Drehmotor", typ: "Komponente", produktKlasse: "M", signale: [s("Freigabe", "A"), s("Störung", "E")] },
            { name: "Positionssensor", typ: "Komponente", produktKlasse: "B", signale: [s("In Position", "E")] },
          ],
        },
        {
          id: "bg-greifer", name: "Greifer", typ: "Baugruppe", kuerzel: "GRF",
          kinder: [
            { name: "Greifventil", typ: "Komponente", produktKlasse: "Q", signale: [s("Greifen", "A"), s("Geschlossen", "E")] },
            { name: "Teilesensor", typ: "Komponente", produktKlasse: "B", signale: [s("Teil vorhanden", "E")] },
          ],
        },
      ],
    },
    {
      titel: "Komponenten",
      hinweis: "Einzelne Betriebsmittel mit typischen Signalen.",
      eintraege: [
        { id: "ko-motor", name: "Motor", typ: "Komponente", produktKlasse: "M", signale: [s("Freigabe", "A"), s("Störung", "E")] },
        { id: "ko-fu", name: "Frequenzumrichter", typ: "Komponente", produktKlasse: "T", signale: [s("Freigabe", "A"), s("Drehzahl Sollwert", "A", "Int"), s("Drehzahl Istwert", "E", "Int"), s("Störung", "E")] },
        { id: "ko-pumpe", name: "Pumpe", typ: "Komponente", produktKlasse: "M", signale: [s("Freigabe", "A"), s("Störung", "E")] },
        { id: "ko-ventil", name: "Ventil", typ: "Komponente", produktKlasse: "Q", signale: [s("Öffnen", "A"), s("Rückmeldung offen", "E")] },
        { id: "ko-magnetventil", name: "Magnetventil", typ: "Komponente", produktKlasse: "Y", signale: [s("Schalten", "A")] },
        { id: "ko-sensor", name: "Sensor", typ: "Komponente", produktKlasse: "B", signale: [s("Signal", "E")] },
        { id: "ko-lichtschranke", name: "Lichtschranke", typ: "Komponente", produktKlasse: "B", signale: [s("Belegt", "E")] },
        { id: "ko-durchfluss", name: "Durchflussmesser", typ: "Komponente", produktKlasse: "B", signale: [s("Durchfluss", "E", "Real")] },
        { id: "ko-temperatur", name: "Temperaturfühler", typ: "Komponente", produktKlasse: "B", signale: [s("Temperatur", "E", "Real")] },
        { id: "ko-druck", name: "Drucksensor", typ: "Komponente", produktKlasse: "B", signale: [s("Druck", "E", "Real")] },
        { id: "ko-taster", name: "Taster", typ: "Komponente", produktKlasse: "S", signale: [s("Betätigt", "E")] },
        { id: "ko-nothalt", name: "Not-Halt-Taster", typ: "Komponente", produktKlasse: "S", signale: [s("Ausgelöst", "E")] },
        { id: "ko-leuchte", name: "Leuchtmelder", typ: "Komponente", produktKlasse: "P", signale: [s("Ein", "A")] },
      ],
    },
    {
      titel: "Grundbausteine",
      hinweis: "Leere Bausteine zum selbst Benennen.",
      eintraege: [
        { id: "gr-teilanlage", name: "Teilanlage", typ: "Teilanlage", kuerzel: "" },
        { id: "gr-station", name: "Station (leer)", typ: "Station", kuerzel: "" },
        { id: "gr-baugruppe", name: "Baugruppe (leer)", typ: "Baugruppe", kuerzel: "" },
        { id: "gr-komponente", name: "Komponente (leer)", typ: "Komponente", produktKlasse: "" },
      ],
    },
  ];

  function finde(vorlageId) {
    for (const gruppe of GRUPPEN) {
      const eintrag = gruppe.eintraege.find((e) => e.id === vorlageId);
      if (eintrag) return eintrag;
    }
    return null;
  }

  /**
   * Fügt eine Vorlage (inkl. Kind-Bausteinen) unter `elternId` in das Projekt
   * ein. Namen werden unter Geschwistern automatisch nummeriert.
   * Liefert das eingefügte Wurzelelement.
   */
  function instanziiere(projekt, vorlageId, elternId) {
    const Model = dep("Model", "./model.js");
    const vorlage = finde(vorlageId);
    if (!vorlage) return null;

    function anlegen(v, eltern, nummerieren) {
      const el = Model.neuesElement({
        name: nummerieren ? Model.eindeutigerName(projekt, eltern, v.name) : v.name,
        typ: v.typ,
        elternId: eltern,
        kuerzel: v.kuerzel !== undefined ? v.kuerzel : "",
        produktKlasse: v.produktKlasse || "",
        ort: v.ort || "",
        signale: (v.signale || []).map((sig) => Model.neuesSignal(sig)),
      });
      projekt.elemente.push(el);
      for (const kind of v.kinder || []) anlegen(kind, el.id, false);
      return el;
    }

    return anlegen(vorlage, elternId || null, true);
  }

  const api = { GRUPPEN, finde, instanziiere };

  ns.Vorlagen = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

})(typeof window !== "undefined" ? (window.SysM = window.SysM || {}) : {});
