(function attachTmaData(root) {
  const aliases = {
    po: ["TMA Purchase Order Number", "Purchase Order Number", "TMA PO Number"],
    incoterms: ["Incoterms", "Incoterm"],
    requestor: ["Requestor Name", "Requester Name", "Requestor"],
    assignedTeam: ["Assigned IMPEX Team Member", "Assigned Impex Team Member", "Assigned Impex Team", "Assigned IMPEX Team"],
    approvedAgent: ["Approved Agent", "Approved Agent Name", "Agent"],
    mode: ["Airfreight or Sea Freight", "Air Freight or Sea Freight", "Airfreight or Sea"],
    freightType: ["Freight Type"],
    cargoReady: ["Cargo Ready Date", "Cargo Ready"],
    etd: ["Vessel/Flight ETD", "Vessel Flight ETD", "ETD"],
    revisedEtd: ["Revised ETD", "revised ETD"],
    eta: ["Vessel/Flight ETA", "Vessel Flight ETA", "ETA"],
    telexHbl: ["Telex-released HBL", "Telex Released HBL"],
    origin: ["Port of Origin", "Origin Port"],
    discharge: ["Port of Discharge", "Destination Port"],
    container: ["Container#", "Container #", "Container Number", "Container No"],
    carrier: ["Shipping Line/Carrier", "Shipping Line Carrier", "Carrier"],
    vessel: ["Vessel/Flight Name", "Vessel Flight Name", "Vessel Name"],
    booking: ["Booking Number SO#", "Booking Number SO", "Booking Number"],
    status: ["Status"],
    direction: ["Inbound/Outbound", "Inbound Outbound", "Direction"],
    shipper: ["Origin Shipper Name", "Shipper Name"],
    track: ["Track"],
    lc: ["LC Number", "LC No"]
  };

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/_x([0-9a-f]{4})_/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  }

  function cleanText(value) {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(", ");
    if (typeof value === "object") {
      if (Array.isArray(value.results)) return value.results.map(cleanText).filter(Boolean).join(", ");
      if (value.Title || value.Name || value.LookupValue) return cleanText(value.Title || value.Name || value.LookupValue);
      return "";
    }
    return String(value)
      .replace(/<[^>]*>/g, "")
      .replace(/;#/g, ", ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function property(object, names) {
    if (!object) return undefined;
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(object, name)) return object[name];
    }
    const lowerNames = names.map((name) => name.toLowerCase());
    const foundKey = Object.keys(object).find((key) => lowerNames.includes(key.toLowerCase()));
    return foundKey ? object[foundKey] : undefined;
  }

  function buildFieldResolution(fields, items) {
    const visible = (fields || []).filter((field) => {
      const hidden = property(field, ["Hidden", "hidden"]);
      return hidden !== true && hidden !== "true";
    });
    const sampleKeys = new Set();
    for (const item of (items || []).slice(0, 25)) {
      Object.keys(item || {}).forEach((key) => sampleKeys.add(key));
      Object.keys(item?.FieldValuesAsText || item?.fieldValuesAsText || {}).forEach((key) => sampleKeys.add(key));
    }
    const fieldMap = {};
    const mappingDiagnostics = {};

    for (const [key, candidateTitles] of Object.entries(aliases)) {
      const candidates = candidateTitles.map(normalize);
      let field = null;
      let matchedAlias = "";
      for (const candidate of candidates) {
        const matches = visible.filter((item) => normalize(property(item, ["Title", "title", "DisplayName", "displayName"])) === candidate);
        if (matches.length === 1) {
          field = matches[0];
          matchedAlias = candidate;
          break;
        }
        if (matches.length > 1) {
          mappingDiagnostics[key] = {
            method: "ambiguous",
            confidence: "blocked",
            warning: `Multiple SharePoint columns match ${candidateTitles[candidates.indexOf(candidate)]}.`
          };
          break;
        }
      }
      if (field) {
        const internalName = property(field, ["InternalName", "internalName", "StaticName", "staticName", "EntityPropertyName", "entityPropertyName"]) || "";
        fieldMap[key] = internalName;
        mappingDiagnostics[key] = {
          internalName,
          title: cleanText(property(field, ["Title", "title", "DisplayName", "displayName"])),
          method: "schema-title",
          confidence: "high",
          matchedAlias
        };
        continue;
      }
      if (mappingDiagnostics[key]?.method === "ambiguous") {
        fieldMap[key] = "";
        continue;
      }

      const fuzzyMatches = visible.filter((item) => {
        const normalizedTitle = normalize(property(item, ["Title", "title", "DisplayName", "displayName"]));
        return normalizedTitle.length > 3 && candidates.some((candidate) => normalizedTitle.includes(candidate) || candidate.includes(normalizedTitle));
      });
      if (fuzzyMatches.length === 1) {
        const fuzzyField = fuzzyMatches[0];
        const internalName = property(fuzzyField, ["InternalName", "internalName", "StaticName", "staticName", "EntityPropertyName", "entityPropertyName"]) || "";
        fieldMap[key] = internalName;
        mappingDiagnostics[key] = {
          internalName,
          title: cleanText(property(fuzzyField, ["Title", "title", "DisplayName", "displayName"])),
          method: "schema-unique-fuzzy",
          confidence: "medium",
          warning: "Mapped from one unique SharePoint title containing an approved alias."
        };
        continue;
      }
      if (fuzzyMatches.length > 1) {
        fieldMap[key] = "";
        mappingDiagnostics[key] = {
          internalName: "",
          title: "",
          method: "ambiguous",
          confidence: "blocked",
          warning: "Multiple SharePoint column titles contain an approved alias."
        };
        continue;
      }

      const fallbackKeys = [...sampleKeys].filter((sampleKey) => {
        const normalizedKey = normalize(sampleKey);
        return normalizedKey.length > 3 && candidates.includes(normalizedKey);
      });
      const fallbackKey = fallbackKeys.length === 1 ? fallbackKeys[0] : "";
      fieldMap[key] = fallbackKey;
      mappingDiagnostics[key] = fallbackKey
        ? { internalName: fallbackKey, title: "", method: "sample-key", confidence: "medium", warning: "Mapped from item data because field schema did not contain an exact title." }
        : {
            internalName: "",
            title: "",
            method: fallbackKeys.length > 1 ? "ambiguous" : "not-detected",
            confidence: "blocked",
            warning: fallbackKeys.length > 1 ? "Multiple item keys matched this field." : "No exact SharePoint column title was detected."
          };
    }

    return { fieldMap, mappingDiagnostics };
  }

  function buildFieldMap(fields, items) {
    return buildFieldResolution(fields, items).fieldMap;
  }

  function getFieldText(item, internalName) {
    if (!internalName) return "";
    const textBag = item.FieldValuesAsText || item.fieldValuesAsText || {};
    const textValue = property(textBag, [internalName]);
    const rawValue = property(item, [internalName]);
    return cleanText(textValue) || cleanText(rawValue);
  }

  function getAliasedFieldText(item, fields, aliasKey, primaryInternalName) {
    const candidates = (aliases[aliasKey] || []).map(normalize);
    const internalNames = [primaryInternalName];
    for (const candidate of candidates) {
      for (const field of fields || []) {
        const title = normalize(property(field, ["Title", "title", "DisplayName", "displayName"]));
        if (title !== candidate) continue;
        const internalName = property(field, ["InternalName", "internalName", "StaticName", "staticName", "EntityPropertyName", "entityPropertyName"]);
        if (internalName && !internalNames.includes(internalName)) internalNames.push(internalName);
      }
    }
    for (const internalName of internalNames) {
      const value = getFieldText(item, internalName);
      if (value) return value;
    }
    const textBag = item?.FieldValuesAsText || item?.fieldValuesAsText || {};
    const fallbackKey = Object.keys(textBag).find((key) => {
      const normalizedKey = normalize(key);
      return normalizedKey.includes("assigned") && normalizedKey.includes("impex") && normalizedKey.includes("team") && cleanText(textBag[key]);
    });
    return fallbackKey ? cleanText(textBag[fallbackKey]) : "";
  }

  function parseDateInfo(value) {
    const text = cleanText(value);
    if (!text) return { date: null, state: "blank", reliable: true, text: "" };

    const makeDate = (year, month, day, reliable = true, format = "") => {
      const parsed = new Date(year, month - 1, day);
      const valid = !Number.isNaN(parsed.getTime())
        && parsed.getFullYear() === year
        && parsed.getMonth() === month - 1
        && parsed.getDate() === day;
      return valid
        ? { date: parsed, state: reliable ? "valid" : "ambiguous", reliable, text, format }
        : { date: null, state: "invalid", reliable: false, text, format };
    };

    const zonedIso = text.match(/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i);
    if (zonedIso) {
      const instant = new Date(text);
      if (Number.isNaN(instant.getTime())) return { date: null, state: "invalid", reliable: false, text, format: "iso-zoned" };
      const parts = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Australia/Sydney"
      }).formatToParts(instant);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return makeDate(Number(values.year), Number(values.month), Number(values.day), true, "iso-zoned-sydney");
    }

    const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) {
      return makeDate(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]), true, "iso");
    }

    const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
    if (match) {
      let first = Number(match[1]);
      let second = Number(match[2]);
      let year = Number(match[3]);
      if (year < 100) year += 2000;

      let month = first;
      let day = second;
      let reliable = false;
      if (first > 12) {
        day = first;
        month = second;
        reliable = true;
      } else if (second > 12) {
        month = first;
        day = second;
        reliable = true;
      }
      return makeDate(year, month, day, reliable, reliable ? "numeric" : "ambiguous-numeric");
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime())
      ? { date: null, state: "invalid", reliable: false, text, format: "unknown" }
      : { date: startOfDay(parsed), state: "valid", reliable: true, text, format: "named" };
  }

  function parseDate(value) {
    return parseDateInfo(value).date;
  }

  function getFieldDateInfo(item, internalName) {
    if (!internalName) return { date: null, state: "unavailable", reliable: false, text: "", source: "none" };
    const rawValue = property(item, [internalName]);
    const textBag = item.FieldValuesAsText || item.fieldValuesAsText || {};
    const displayValue = property(textBag, [internalName]);
    const rawInfo = parseDateInfo(rawValue);
    const displayInfo = parseDateInfo(displayValue);

    if (rawInfo.state === "valid") return { ...rawInfo, source: "raw" };
    if (displayInfo.state === "valid") return { ...displayInfo, source: "formatted" };
    if (rawInfo.state === "ambiguous") return { ...rawInfo, source: "raw" };
    if (displayInfo.state === "ambiguous") return { ...displayInfo, source: "formatted" };
    if (rawInfo.state === "invalid" || displayInfo.state === "invalid") {
      const selected = rawInfo.state === "invalid" ? rawInfo : displayInfo;
      return { ...selected, source: rawInfo.state === "invalid" ? "raw" : "formatted" };
    }
    return { date: null, state: "blank", reliable: true, text: "", source: "none" };
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function todayInSydney(value) {
    const source = value ? new Date(value) : new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Australia/Sydney"
    }).formatToParts(source);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return new Date(Number(values.year), Number(values.month) - 1, Number(values.day));
  }

  function dayDifference(later, earlier) {
    const laterDay = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
    const earlierDay = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
    return Math.round((laterDay - earlierDay) / 86400000);
  }

  function isActiveStatus(status) {
    const value = normalize(status);
    return ["intransit", "bookingcomplete", "bookingsenttoagent"].some((term) => value.includes(term));
  }

  function isAwaitingApprovalStatus(status) {
    return normalize(status) === "quotecomplete";
  }

  function formatDate(date, fallback) {
    if (!date || Number.isNaN(date.getTime())) return cleanText(fallback);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  function dateInputValue(date) {
    if (!date || Number.isNaN(date.getTime())) return "";
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function classifyUrgency({ status, incoterms, cargoReadyDate, etdDate, revisedEtdDate, revisedEtdPresent = Boolean(revisedEtdDate), etaDate, today, mode, direction, telexHbl, booking, vessel, availability = {}, dateReliability = {} }) {
    const statusValue = normalize(status);
    const incotermValue = normalize(incoterms);
    const modeValue = normalize(mode);
    const directionValue = normalize(direction);
    const inTransit = statusValue.includes("intransit");
    const quoteStage = ["newrequest", "quoteinprogress", "quotecomplete"].includes(statusValue);
    const preDeparture = ["newrequest", "quoteinprogress", "quotecomplete", "bookingsenttoagent", "bookingcomplete"].includes(statusValue);
    const active = isActiveStatus(status);
    const available = (key) => availability[key] !== false;
    const reliable = (key) => dateReliability[key] !== false;
    const effectiveEtdDate = revisedEtdPresent
      ? (reliable("revisedEtd") ? revisedEtdDate : null)
      : (reliable("etd") ? etdDate : null);
    const daysToArrival = etaDate ? dayDifference(etaDate, today) : null;
    const daysToDeparture = effectiveEtdDate ? dayDifference(effectiveEtdDate, today) : null;
    const hblReleased = ["yes", "true", "1", "checked"].includes(cleanText(telexHbl).toLowerCase());
    const signals = [];
    let order = 0;
    const addSignal = (signal) => signals.push({ ...signal, order: order++ });

    if (inTransit && available("eta") && reliable("eta") && etaDate && startOfDay(etaDate) < today) {
      const days = Math.max(1, dayDifference(today, etaDate));
      addSignal({
        code: "eta_overdue",
        level: "critical",
        rank: 3,
        reason: `ETA overdue ${days}d`,
        rule: "ETA tracking",
        action: "Confirm the latest ETA, delay cause and delivery or clearance recovery plan.",
        horizonDays: -days
      });
    }

    if (inTransit && available("eta") && reliable("eta") && !etaDate) {
      addSignal({
        code: "eta_missing",
        level: "high",
        rank: 2,
        reason: "ETA missing in transit",
        rule: "ETA data quality",
        action: "Obtain and update the ETA, then confirm the destination delivery or clearance plan.",
        horizonDays: 0
      });
    }

    if (inTransit && available("eta") && available("telexHbl") && reliable("eta") && modeValue.includes("sea") && directionValue.includes("inbound") && daysToArrival !== null && daysToArrival >= 0 && daysToArrival <= 5 && !hblReleased) {
      addSignal({
        code: "hbl_release",
        level: "high",
        rank: 2,
        reason: `HBL not released · ETA ${daysToArrival === 0 ? "today" : `in ${daysToArrival}d`}`,
        rule: "HBL release readiness",
        action: "Obtain the telex HBL release and confirm customs clearance readiness before arrival.",
        horizonDays: daysToArrival
      });
    }

    const readinessMissing = [
      available("booking") && !cleanText(booking) ? "booking" : "",
      available("vessel") && !cleanText(vessel) ? "vessel/flight" : ""
    ].filter(Boolean);
    if (preDeparture && reliable("etd") && daysToDeparture !== null && daysToDeparture >= 0 && daysToDeparture <= 3 && readinessMissing.length) {
      const missing = readinessMissing.join(" + ");
      addSignal({
        code: "departure_readiness",
        level: "high",
        rank: 2,
        reason: `${missing} missing · ETD ${daysToDeparture === 0 ? "today" : `in ${daysToDeparture}d`}`,
        rule: "Departure readiness",
        action: "Confirm the booking, vessel or flight and departure readiness before ETD.",
        horizonDays: daysToDeparture
      });
    }

    if (preDeparture && reliable("etd") && reliable("revisedEtd") && incotermValue.includes("fob") && etdDate && revisedEtdDate && startOfDay(etdDate) < today && startOfDay(revisedEtdDate) < today) {
      const days = Math.max(1, dayDifference(today, revisedEtdDate));
      addSignal({
        code: "fob_etd_overdue",
        level: "high",
        rank: 2,
        reason: `FOB revised ETD overdue ${days}d`,
        rule: "ETD tracking",
        action: "Confirm the revised sailing plan and advise the downstream impact.",
        horizonDays: -days
      });
    }

    if (quoteStage && available("cargoReady") && reliable("cargoReady") && cargoReadyDate && startOfDay(cargoReadyDate) <= today) {
      const days = Math.max(0, dayDifference(today, cargoReadyDate));
      addSignal({
        code: "booking_pending",
        level: "high",
        rank: 2,
        reason: days ? `Cargo ready ${days}d ago` : "Cargo ready today",
        rule: "Booking pending",
        action: "Secure the booking or escalate allocation before cargo waits at origin.",
        horizonDays: -days
      });
    }

    if ((active || preDeparture) && reliable("etd") && reliable("revisedEtd") && etdDate && revisedEtdDate) {
      const slipDays = dayDifference(revisedEtdDate, etdDate);
      if (slipDays >= 3) {
        addSignal({
          code: "schedule_slip",
          level: "watch",
          rank: 1,
          reason: `ETD slipped ${slipDays}d`,
          rule: "Schedule change",
          action: "Confirm the reason for the ETD slippage and assess the downstream impact.",
          horizonDays: daysToDeparture ?? slipDays
        });
      }
    }

    if (active && available("eta") && reliable("eta") && daysToArrival !== null && daysToArrival >= 0 && daysToArrival <= 2) {
      addSignal({
        code: "arrival_watch",
        level: "watch",
        rank: 1,
        reason: daysToArrival === 0 ? "Arriving today" : `Arriving in ${daysToArrival}d`,
        rule: "Arrival watch",
        action: "Confirm destination clearance and delivery readiness.",
        horizonDays: daysToArrival
      });
    }

    signals.sort((a, b) => b.rank - a.rank || a.order - b.order);
    const cleanedSignals = signals.map(({ order: _order, ...signal }) => signal);
    const primary = cleanedSignals[0] || {
      code: "on_schedule",
      level: "normal",
      rank: 0,
      reason: "On schedule",
      rule: "Normal",
      action: "Continue routine monitoring.",
      horizonDays: null
    };
    return { ...primary, signals: cleanedSignals };
  }

  function operationalMissingFields(row, availability = {}) {
    if (!row?.active && !row?.isRisk) return [];
    const missing = [];
    const available = (key) => availability[key] !== false;
    const add = (key, label, value) => {
      if (available(key) && !cleanText(value)) missing.push(label);
    };

    add("po", "PO number", row.po);
    add("origin", "Port of origin", row.origin);
    add("discharge", "Port of discharge", row.discharge);
    add("shipper", "Origin shipper", row.shipper);
    add("mode", "Transport mode", row.mode);
    if ((available("approvedAgent") || available("carrier")) && !cleanText(row.approvedAgent) && !cleanText(row.carrier)) missing.push("Agent / carrier");

    const status = normalize(row.status);
    if (status.includes("intransit")) {
      add("eta", "ETA", row.eta);
      add("vessel", "Vessel / flight", row.vessel);
      if (normalize(row.mode).includes("sea")) add("container", "Container", row.container);
    }
    if (["bookingcomplete", "bookingsenttoagent"].includes(status)) {
      add("etd", "ETD", row.etd);
      add("booking", "Booking number", row.booking);
    }
    return missing;
  }

  function buildDataQualityIssues({ cargoReadyInfo, etdInfo, revisedEtdInfo, etaInfo }) {
    const issues = [];
    const inspectDate = (key, label, info) => {
      if (info?.state === "invalid") {
        issues.push({ code: `${key}_invalid`, severity: "high", label: `${label} unreadable`, detail: `${label} contains an invalid date value: ${cleanText(info.text) || "unknown"}.` });
      } else if (info?.state === "ambiguous") {
        issues.push({ code: `${key}_ambiguous`, severity: "warning", label: `${label} date ambiguous`, detail: `${label} could be interpreted as either DD/MM or MM/DD because no ISO value was returned.` });
      }
    };
    inspectDate("cargo_ready", "Cargo ready", cargoReadyInfo);
    inspectDate("etd", "ETD", etdInfo);
    inspectDate("revised_etd", "Revised ETD", revisedEtdInfo);
    inspectDate("eta", "ETA", etaInfo);

    const effectiveEtdInfo = revisedEtdInfo?.text ? revisedEtdInfo : etdInfo;
    if (effectiveEtdInfo?.reliable && etaInfo?.reliable && effectiveEtdInfo.date && etaInfo.date && startOfDay(etaInfo.date) < startOfDay(effectiveEtdInfo.date)) {
      issues.push({ code: "eta_before_etd", severity: "high", label: "ETA earlier than ETD", detail: "The arrival date is earlier than the effective departure date. Verify both schedule fields before acting on ETA risk." });
    }
    return issues;
  }

  function buildShipmentSummary(row) {
    if (!row) return "";
    const route = `${cleanText(row.origin) || "Origin pending"} → ${cleanText(row.discharge) || "Destination pending"}`;
    const mode = [cleanText(row.mode), cleanText(row.freightType)].filter(Boolean).join(" / ") || "Pending";
    const carrier = [...new Set([cleanText(row.approvedAgent), cleanText(row.carrier)].filter(Boolean))].join(" / ") || "Not assigned";
    const lines = [
      `TMA Freight ID${row.id || ""}${row.po ? ` | ${cleanText(row.po)}` : ""}`,
      `Status: ${cleanText(row.status) || "No status"}`,
      `Risk: ${cleanText(row.urgencyLevel) || "normal"} | ${cleanText(row.urgencyReason) || "On schedule"}`,
      `IMPEX Owner: ${cleanText(row.assignedTeam) || "Unassigned"}`,
      `Route: ${route}`,
      `Origin Shipper: ${cleanText(row.shipper) || "Not entered"}`,
      `Mode: ${mode}`,
      `Agent / Carrier: ${carrier}`,
      `Container: ${cleanText(row.container) || "Pending"}`,
      `Vessel / Flight: ${cleanText(row.vessel) || "Pending"}`,
      `Cargo Ready: ${cleanText(row.cargoReady) || "Pending"}`,
      `ETD: ${cleanText(row.etd) || "Pending"}`,
      `Revised ETD: ${cleanText(row.revisedEtd) || "Pending"}`,
      `ETA: ${cleanText(row.eta) || "Pending"}`,
      `Booking SO#: ${cleanText(row.booking) || "Pending"}`
    ];
    if (Array.isArray(row.riskSignals) && row.riskSignals.length > 1) lines.push(`Other signals: ${row.riskSignals.slice(1).map((signal) => signal.reason).join("; ")}`);
    if (Array.isArray(row.missingFields) && row.missingFields.length) lines.push(`Data gaps: ${row.missingFields.join(", ")}`);
    return lines.join("\n");
  }

  function buildFollowUpMessage(row) {
    if (!row) return "";
    const owner = cleanText(row.assignedTeam) || "team";
    const firstName = owner === "team" ? "team" : owner.split(/\s+/)[0];
    const route = `${cleanText(row.origin) || "Origin pending"} → ${cleanText(row.discharge) || "Destination pending"}`;
    const schedule = [`ETA ${cleanText(row.eta) || "Pending"}`, `ETD ${cleanText(row.revisedEtd) || cleanText(row.etd) || "Pending"}`].join(" | ");
    const primarySignal = row.riskSignals?.[0];
    const action = cleanText(primarySignal?.action || row.urgencyAction) || "Review the shipment and update the SharePoint List.";
    const otherSignals = Array.isArray(row.riskSignals) ? row.riskSignals.slice(1).map((signal) => signal.reason).filter(Boolean) : [];
    return [
      `Hi ${firstName},`,
      "",
      "Please follow up the shipment below and update the TMA Freight Request List after action:",
      `Shipment: ID${row.id || ""}${row.po ? ` | ${cleanText(row.po)}` : ""}`,
      `Owner: ${owner === "team" ? "Unassigned — please allocate" : owner}`,
      `Risk: ${cleanText(row.urgencyReason) || "Review required"}`,
      ...(otherSignals.length ? [`Other signals: ${otherSignals.join("; ")}`] : []),
      `Route: ${route}`,
      `Status: ${cleanText(row.status) || "No status"}`,
      `Schedule: ${schedule}`,
      `Required action: ${action}`,
      "",
      "Thanks."
    ].join("\n");
  }

  function buildRiskHandoff(rows, dateLabel) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const alerts = safeRows.filter((row) => row.urgencyRank >= 2)
      .sort((a, b) => b.urgencyRank - a.urgencyRank || a.etaTimestamp - b.etaTimestamp || b.id - a.id);
    const grouped = new Map();
    for (const row of alerts) {
      const owner = cleanText(row.assignedTeam) || "Unassigned";
      if (!grouped.has(owner)) grouped.set(owner, []);
      grouped.get(owner).push(row);
    }
    const groups = [...grouped.entries()].sort(([ownerA, rowsA], [ownerB, rowsB]) => {
      if (ownerA === "Unassigned") return -1;
      if (ownerB === "Unassigned") return 1;
      const rankA = Math.max(...rowsA.map((row) => row.urgencyRank));
      const rankB = Math.max(...rowsB.map((row) => row.urgencyRank));
      return rankB - rankA || rowsB.length - rowsA.length || ownerA.localeCompare(ownerB);
    });
    const critical = alerts.filter((row) => row.urgencyLevel === "critical").length;
    const high = alerts.filter((row) => row.urgencyLevel === "high").length;
    const lines = [
      `TMA Logistics Risk Handoff | ${cleanText(dateLabel) || formatDate(new Date())}`,
      `Risk alerts ${alerts.length} | Critical ${critical} | High ${high}`
    ];
    if (!alerts.length) {
      lines.push("", "No Critical or High risk alerts under the current rules.");
      return lines.join("\n");
    }
    for (const [owner, ownerRows] of groups) {
      lines.push("", `${owner} (${ownerRows.length})`);
      ownerRows.slice(0, 10).forEach((row) => {
        const route = `${cleanText(row.origin) || "Origin pending"} → ${cleanText(row.discharge) || "Destination pending"}`;
        lines.push(`• ID${row.id}${row.po ? ` | ${cleanText(row.po)}` : ""} | ${route} | ${cleanText(row.urgencyReason)}`);
        const action = cleanText(row.riskSignals?.[0]?.action || row.urgencyAction);
        if (action) lines.push(`  Action: ${action}`);
      });
      if (ownerRows.length > 10) lines.push(`• +${ownerRows.length - 10} more`);
    }
    lines.push("", "Please update the TMA Freight Request List after follow-up.");
    return lines.join("\n");
  }

  function transformItems(items, fields, todayValue) {
    const inputItems = Array.isArray(items) ? items : [];
    const seenIds = new Set();
    const duplicateIds = new Set();
    let duplicateRowCount = 0;
    let invalidIdCount = 0;
    const uniqueItems = inputItems.filter((item) => {
      const textBag = item?.FieldValuesAsText || item?.fieldValuesAsText || {};
      const id = Number(item?.ID || item?.Id || textBag.ID || 0);
      if (!Number.isInteger(id) || id <= 0) {
        invalidIdCount += 1;
        return false;
      }
      if (seenIds.has(id)) {
        duplicateIds.add(id);
        duplicateRowCount += 1;
        return false;
      }
      seenIds.add(id);
      return true;
    });
    const { fieldMap, mappingDiagnostics } = buildFieldResolution(fields, uniqueItems);
    const fieldAvailability = Object.fromEntries(Object.keys(aliases).map((key) => [key, Boolean(fieldMap[key])]));
    const today = todayInSydney(todayValue);

    const rows = uniqueItems.map((item) => {
      const textBag = item.FieldValuesAsText || item.fieldValuesAsText || {};
      const id = Number(item.ID || item.Id || textBag.ID || 0);
      const cargoReadyInfo = getFieldDateInfo(item, fieldMap.cargoReady);
      const etdInfo = getFieldDateInfo(item, fieldMap.etd);
      const revisedEtdInfo = getFieldDateInfo(item, fieldMap.revisedEtd);
      const etaInfo = getFieldDateInfo(item, fieldMap.eta);
      const cargoReadyText = cargoReadyInfo.text;
      const etdText = etdInfo.text;
      const revisedEtdText = revisedEtdInfo.text;
      const etaText = etaInfo.text;
      const status = getFieldText(item, fieldMap.status) || "No status";
      const incoterms = getFieldText(item, fieldMap.incoterms);
      const assignedTeam = getAliasedFieldText(item, fields, "assignedTeam", fieldMap.assignedTeam);
      const mode = getFieldText(item, fieldMap.mode);
      const direction = getFieldText(item, fieldMap.direction);
      const telexHbl = getFieldText(item, fieldMap.telexHbl);
      const booking = getFieldText(item, fieldMap.booking);
      const vessel = getFieldText(item, fieldMap.vessel);
      const cargoReadyDate = cargoReadyInfo.date;
      const etdDate = etdInfo.date;
      const revisedEtdDate = revisedEtdInfo.date;
      const etaDate = etaInfo.date;
      const active = isActiveStatus(status);
      const daysToArrival = etaDate && etaInfo.reliable ? dayDifference(etaDate, today) : null;
      const dateReliability = {
        cargoReady: cargoReadyInfo.reliable,
        etd: etdInfo.reliable,
        revisedEtd: revisedEtdInfo.reliable,
        eta: etaInfo.reliable
      };
      const urgency = classifyUrgency({
        status,
        incoterms,
        cargoReadyDate,
        etdDate,
        revisedEtdDate,
        revisedEtdPresent: Boolean(cleanText(revisedEtdText)),
        etaDate,
        today,
        mode,
        direction,
        telexHbl,
        booking,
        vessel,
        availability: fieldAvailability,
        dateReliability
      });

      const row = {
        id,
        etag: item["@odata.etag"] || item["odata.etag"] || item.__metadata?.etag || "*",
        po: getFieldText(item, fieldMap.po),
        incoterms,
        requestor: getFieldText(item, fieldMap.requestor),
        assignedTeam,
        approvedAgent: getFieldText(item, fieldMap.approvedAgent),
        mode,
        freightType: getFieldText(item, fieldMap.freightType),
        cargoReady: formatDate(cargoReadyInfo.reliable ? cargoReadyDate : null, cargoReadyText),
        cargoReadyInput: dateInputValue(cargoReadyInfo.reliable ? cargoReadyDate : null),
        etd: formatDate(etdInfo.reliable ? etdDate : null, etdText),
        etdInput: dateInputValue(etdInfo.reliable ? etdDate : null),
        revisedEtd: formatDate(revisedEtdInfo.reliable ? revisedEtdDate : null, revisedEtdText),
        revisedEtdInput: dateInputValue(revisedEtdInfo.reliable ? revisedEtdDate : null),
        eta: formatDate(etaInfo.reliable ? etaDate : null, etaText),
        etaInput: dateInputValue(etaInfo.reliable ? etaDate : null),
        telexHbl,
        origin: getFieldText(item, fieldMap.origin),
        discharge: getFieldText(item, fieldMap.discharge),
        container: getFieldText(item, fieldMap.container),
        carrier: getFieldText(item, fieldMap.carrier),
        vessel,
        booking,
        status,
        direction,
        shipper: getFieldText(item, fieldMap.shipper),
        track: getFieldText(item, fieldMap.track),
        lc: getFieldText(item, fieldMap.lc),
        modified: cleanText(item.Modified || textBag.Modified),
        active,
        isRisk: urgency.rank >= 2,
        urgencyLevel: urgency.level,
        urgencyRank: urgency.rank,
        urgencyReason: urgency.reason,
        urgencyRule: urgency.rule,
        urgencyAction: urgency.action,
        riskSignals: urgency.signals,
        riskSignalCount: urgency.signals.length,
        arrivingSoon: Boolean(active && daysToArrival !== null && daysToArrival >= 0 && daysToArrival <= 7),
        daysToArrival,
        etaTimestamp: etaDate && etaInfo.reliable ? etaDate.getTime() : Number.MAX_SAFE_INTEGER
      };
      row.missingFields = operationalMissingFields(row, fieldAvailability);
      row.hasDataGaps = row.missingFields.length > 0;
      row.dataIssues = buildDataQualityIssues({ cargoReadyInfo, etdInfo, revisedEtdInfo, etaInfo });
      row.hasDataIssues = row.dataIssues.length > 0;
      return row;
    });

    const fieldDiagnostics = (fields || []).map((field) => ({
      title: cleanText(property(field, ["Title", "title", "DisplayName", "displayName"])),
      internalName: cleanText(property(field, ["InternalName", "internalName", "StaticName", "staticName", "EntityPropertyName", "entityPropertyName"])),
      type: cleanText(property(field, ["TypeAsString", "typeAsString"])),
      readOnly: property(field, ["ReadOnlyField", "readOnlyField"]) === true
    })).filter((field) => field.title || field.internalName);
    const sampleKeys = [...new Set((items || []).slice(0, 3).flatMap((item) => [
      ...Object.keys(item || {}),
      ...Object.keys(item?.FieldValuesAsText || item?.fieldValuesAsText || {})
    ]))].sort();

    const monitoredFields = ["po", "status", "assignedTeam", "approvedAgent", "carrier", "incoterms", "mode", "cargoReady", "etd", "revisedEtd", "eta", "telexHbl", "origin", "discharge", "container", "vessel", "booking", "direction", "shipper"];
    const unmappedFields = monitoredFields.filter((key) => !fieldAvailability[key]).map((key) => aliases[key][0]);
    const lowConfidenceFields = monitoredFields.filter((key) => mappingDiagnostics[key]?.confidence === "medium").map((key) => aliases[key][0]);
    const sourceQuality = {
      inputCount: inputItems.length,
      rowCount: rows.length,
      duplicateIds: [...duplicateIds].sort((a, b) => a - b),
      duplicateRowCount,
      invalidIdCount,
      unmappedFields,
      lowConfidenceFields,
      dataIssueCount: rows.filter((row) => row.hasDataIssues).length,
      ambiguousDateCount: rows.reduce((count, row) => count + row.dataIssues.filter((issue) => issue.code.endsWith("_ambiguous")).length, 0)
    };

    return { rows, fieldMap, mappingDiagnostics, fieldAvailability, fieldDiagnostics, sampleKeys, sourceQuality };
  }

  function computeMetrics(rows) {
    const statuses = new Map();
    for (const row of rows) {
      statuses.set(row.status, (statuses.get(row.status) || 0) + 1);
    }

    return {
      active: rows.filter((row) => row.active).length,
      awaiting: rows.filter((row) => isAwaitingApprovalStatus(row.status)).length,
      risk: rows.filter((row) => row.isRisk).length,
      arrivingWeek: rows.filter((row) => row.arrivingSoon).length,
      statuses: [...statuses.entries()].sort((a, b) => b[1] - a[1])
    };
  }

  function csvCell(value) {
    let text = cleanText(value).replace(/"/g, '""');
    if (/^[=+@-]/.test(text)) text = `'${text}`;
    return `"${text}"`;
  }

  root.TmaData = {
    aliases,
    normalize,
    cleanText,
    buildFieldResolution,
    buildFieldMap,
    parseDateInfo,
    parseDate,
    formatDate,
    dateInputValue,
    classifyUrgency,
    operationalMissingFields,
    buildShipmentSummary,
    buildFollowUpMessage,
    buildRiskHandoff,
    transformItems,
    computeMetrics,
    csvCell
  };
})(globalThis);
