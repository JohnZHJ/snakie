const LIST_URL = "https://tmaaust-my.sharepoint.com/personal/sharepoint_admin_tmagroup_com_au/Lists/TMA%20Freight%20Request%20Form/AllItems.aspx?viewid=fec6c44f-e46d-4419-ba4f-71cf62a3ac26";
const NEW_ITEM_URL = "https://tmaaust-my.sharepoint.com/personal/sharepoint_admin_tmagroup_com_au/Lists/TMA%20Freight%20Request%20Form/NewForm.aspx";
const ITEM_URL_BASE = "https://tmaaust-my.sharepoint.com/personal/sharepoint_admin_tmagroup_com_au/Lists/TMA%20Freight%20Request%20Form/DispForm.aspx?ID=";
const TARGET_PATH = "/lists/tma freight request form/";

const state = {
  rows: [],
  fieldMap: {},
  mappingDiagnostics: {},
  fieldDiagnostics: [],
  sampleKeys: [],
  writableFieldNames: new Set(),
  writableFields: new Map(),
  sourceQuality: {},
  sourceDiagnostics: {},
  filteredRows: [],
  sourceTabId: null,
  fetchedAt: null,
  loadRequestId: 0,
  loading: false,
  hasLoaded: false,
  editingRow: null,
  pendingChanges: [],
  saving: false,
  quickView: "active"
};

const elements = {
  activeMetric: document.querySelector("#activeMetric"),
  approvalMetric: document.querySelector("#approvalMetric"),
  riskMetric: document.querySelector("#riskMetric"),
  arrivalMetric: document.querySelector("#arrivalMetric"),
  shipmentRows: document.querySelector("#shipmentRows"),
  resultCount: document.querySelector("#resultCount"),
  statusBreakdown: document.querySelector("#statusBreakdown"),
  urgentQueue: document.querySelector("#urgentQueue"),
  ownerRiskBreakdown: document.querySelector("#ownerRiskBreakdown"),
  quickViews: document.querySelector("#quickViews"),
  shipmentsTitle: document.querySelector("#shipmentsTitle"),
  statusFilter: document.querySelector("#statusFilter"),
  directionFilter: document.querySelector("#directionFilter"),
  urgencyFilter: document.querySelector("#urgencyFilter"),
  ownerFilter: document.querySelector("#ownerFilter"),
  sortFilter: document.querySelector("#sortFilter"),
  searchInput: document.querySelector("#searchInput"),
  syncLabel: document.querySelector("#syncLabel"),
  mappingOutput: document.querySelector("#mappingOutput"),
  setupOverlay: document.querySelector("#setupOverlay"),
  setupMessage: document.querySelector("#setupMessage"),
  toast: document.querySelector("#toast"),
  dataAssurance: document.querySelector("#dataAssurance"),
  assuranceIcon: document.querySelector("#assuranceIcon"),
  assuranceTitle: document.querySelector("#assuranceTitle"),
  assuranceDetail: document.querySelector("#assuranceDetail"),
  uniqueRecordMetric: document.querySelector("#uniqueRecordMetric"),
  blockedRecordMetric: document.querySelector("#blockedRecordMetric"),
  dataIssueMetric: document.querySelector("#dataIssueMetric"),
  editorBackdrop: document.querySelector("#editorBackdrop"),
  editorSummary: document.querySelector("#editorSummary"),
  shipmentOverview: document.querySelector("#shipmentOverview"),
  copyFollowUpButton: document.querySelector("#copyFollowUpButton"),
  copySummaryButton: document.querySelector("#copySummaryButton"),
  openRecordButton: document.querySelector("#openRecordButton"),
  editForm: document.querySelector("#editForm"),
  confirmPanel: document.querySelector("#confirmPanel"),
  changeList: document.querySelector("#changeList"),
  saveError: document.querySelector("#saveError"),
  confirmUpdateButton: document.querySelector("#confirmUpdateButton"),
  editStatus: document.querySelector("#editStatus"),
  editCargoReady: document.querySelector("#editCargoReady"),
  editEtd: document.querySelector("#editEtd"),
  editRevisedEtd: document.querySelector("#editRevisedEtd"),
  editEta: document.querySelector("#editEta"),
  editShipper: document.querySelector("#editShipper"),
  editOrigin: document.querySelector("#editOrigin"),
  editDischarge: document.querySelector("#editDischarge"),
  editContainer: document.querySelector("#editContainer"),
  editVessel: document.querySelector("#editVessel"),
  editVesselReason: document.querySelector("#editVesselReason"),
  editBooking: document.querySelector("#editBooking"),
  editTelexHbl: document.querySelector("#editTelexHbl"),
  editValidation: document.querySelector("#editValidation")
};

const editorFields = [
  { key: "status", label: "Status", element: elements.editStatus, valueKey: "status", type: "text" },
  { key: "cargoReady", label: "Cargo Ready Date", element: elements.editCargoReady, valueKey: "cargoReadyInput", type: "date" },
  { key: "etd", label: "Vessel/Flight ETD", element: elements.editEtd, valueKey: "etdInput", type: "date" },
  { key: "revisedEtd", label: "Revised ETD", element: elements.editRevisedEtd, valueKey: "revisedEtdInput", type: "date" },
  { key: "eta", label: "Vessel/Flight ETA", element: elements.editEta, valueKey: "etaInput", type: "date" },
  { key: "shipper", label: "Origin Shipper Name", element: elements.editShipper, valueKey: "shipper", type: "text" },
  { key: "origin", label: "Port of Origin", element: elements.editOrigin, valueKey: "origin", type: "text" },
  { key: "discharge", label: "Port of Discharge", element: elements.editDischarge, valueKey: "discharge", type: "text" },
  { key: "container", label: "Container Number", element: elements.editContainer, valueKey: "container", type: "text" },
  { key: "vessel", label: "Vessel / Flight Name", element: elements.editVessel, valueKey: "vessel", type: "text" },
  { key: "booking", label: "Booking Number SO#", element: elements.editBooking, valueKey: "booking", type: "text" },
  { key: "telexHbl", label: "Telex-released HBL", element: elements.editTelexHbl, valueKey: "telexHbl", type: "boolean" }
];

const quickViewDefinitions = [
  { key: "active", label: "Active", title: "Active Shipments", icon: "▰" },
  { key: "all-risk", label: "Risk alerts", title: "Risk Alerts", icon: "!" },
  { key: "eta-overdue", label: "ETA overdue", title: "ETA Overdue", icon: "!" },
  { key: "eta-missing", label: "ETA missing", title: "Missing ETA in Transit", icon: "?" },
  { key: "hbl-release", label: "HBL release", title: "HBL Release Risk", icon: "H" },
  { key: "departure-readiness", label: "Departure readiness", title: "Departure Readiness", icon: "↑" },
  { key: "etd-overdue", label: "FOB ETD overdue", title: "FOB ETD Overdue", icon: "↑" },
  { key: "booking-pending", label: "Booking pending", title: "Booking Pending", icon: "⌛" },
  { key: "schedule-slip", label: "ETD slip", title: "ETD Schedule Slips", icon: "↘" },
  { key: "arriving-week", label: "Arriving 7 days", title: "Arriving This Week", icon: "◫" },
  { key: "missing-info", label: "Missing fields", title: "Shipments Missing Operational Fields", icon: "?" },
  { key: "data-issues", label: "Data checks", title: "Schedule Data Checks", icon: "✓" },
  { key: "all", label: "All records", title: "All Shipments", icon: "≡" },
  { key: "awaiting", label: "Awaiting approval", title: "Awaiting Approval", icon: "✓", hidden: true },
  { key: "urgent", label: "Urgent", title: "Risk Alerts", icon: "!", hidden: true }
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sydneyDateLabel(value = new Date()) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney"
  }).format(value);
}

function isTargetTab(tab) {
  if (!tab?.url) return false;
  try {
    return decodeURIComponent(new URL(tab.url).pathname).toLowerCase().includes(TARGET_PATH);
  } catch {
    return tab.url.toLowerCase().includes("/lists/tma%20freight%20request%20form/");
  }
}

async function findSharePointTab() {
  const tabs = await chrome.tabs.query({ url: "https://tmaaust-my.sharepoint.com/*" });
  return tabs.find(isTargetTab) || null;
}

async function resolveSharePointTab() {
  if (state.sourceTabId) {
    const remembered = await chrome.tabs.get(state.sourceTabId).catch(() => null);
    if (remembered && isTargetTab(remembered)) return remembered;
    state.sourceTabId = null;
  }
  return findSharePointTab();
}

function waitForTabComplete(tabId, timeoutMs = 25000) {
  return new Promise((resolve) => {
    let timer = null;
    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      window.clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(true);
    };
    timer = window.setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(false);
    }, timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab && tab.status === "complete" && !tab.discarded) onUpdated(tabId, { status: "complete" });
    }).catch(() => onUpdated(tabId, { status: "complete" }));
  });
}

async function sendToSharePoint(message) {
  const tab = await resolveSharePointTab();
  if (!tab?.id) throw new Error("Open the TMA Freight Request Form List in another Edge tab first.");
  state.sourceTabId = tab.id;

  if (tab.discarded) {
    await chrome.tabs.reload(tab.id);
    const awake = await waitForTabComplete(tab.id);
    if (!awake) throw new Error("Edge put the SharePoint List tab to sleep and it did not wake in time. Open that tab once, then try again.");
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

function showSetup(message) {
  elements.setupMessage.textContent = message;
  elements.setupOverlay.classList.remove("hidden");
  elements.syncLabel.className = "sync-label offline";
  elements.syncLabel.innerHTML = "<i></i> SharePoint connection needed";
}

function hideSetup() {
  elements.setupOverlay.classList.add("hidden");
}

let toastTimer = null;
function showToast(message, duration = 3000, tone = "") {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("warning", tone === "warning");
  elements.toast.classList.remove("hidden");
  toastTimer = window.setTimeout(() => elements.toast.classList.add("hidden"), duration);
}

function statusClass(status) {
  const normalized = TmaData.normalize(status);
  if (normalized.includes("transit")) return "transit";
  if (normalized.includes("complete")) return "complete";
  if (normalized.includes("agent")) return "agent";
  if (normalized.includes("approval") || normalized.includes("approve")) return "approval";
  if (normalized.includes("cancel")) return "cancelled";
  return "default";
}

function urgencyClass(level) {
  return ["critical", "high", "watch"].includes(level) ? level : "normal";
}

function rowMatchesQuickView(row, viewKey) {
  const hasSignal = (code) => row.riskSignals?.some((signal) => signal.code === code);
  if (viewKey === "active") return row.active;
  if (viewKey === "all-risk") return row.urgencyRank >= 2;
  if (viewKey === "eta-overdue") return hasSignal("eta_overdue");
  if (viewKey === "eta-missing") return hasSignal("eta_missing");
  if (viewKey === "hbl-release") return hasSignal("hbl_release");
  if (viewKey === "departure-readiness") return hasSignal("departure_readiness");
  if (viewKey === "etd-overdue") return hasSignal("fob_etd_overdue");
  if (viewKey === "booking-pending") return hasSignal("booking_pending");
  if (viewKey === "schedule-slip") return hasSignal("schedule_slip");
  if (viewKey === "arriving-week") return row.arrivingSoon;
  if (viewKey === "missing-info") return row.active && row.hasDataGaps;
  if (viewKey === "data-issues") return row.hasDataIssues;
  if (viewKey === "awaiting") return TmaData.normalize(row.status) === "quotecomplete";
  if (viewKey === "urgent") return row.urgencyRank >= 2;
  return true;
}

function updateQuickViewSelection() {
  document.querySelectorAll("[data-quick-view]").forEach((button) => {
    const selected = button.dataset.quickView === state.quickView;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const definition = quickViewDefinitions.find((item) => item.key === state.quickView);
  elements.shipmentsTitle.textContent = definition?.title || "Shipments";
}

function renderQuickViews(rows) {
  elements.quickViews.innerHTML = quickViewDefinitions.filter((view) => !view.hidden).map((view) => {
    const count = rows.filter((row) => rowMatchesQuickView(row, view.key)).length;
    return `<button type="button" class="quick-view" data-quick-view="${view.key}"><span>${view.icon}</span><strong>${escapeHtml(view.label)}</strong><b>${count}</b></button>`;
  }).join("");
  updateQuickViewSelection();
}

function selectQuickView(viewKey) {
  if (!quickViewDefinitions.some((view) => view.key === viewKey)) return;
  state.quickView = viewKey;
  elements.statusFilter.value = "all";
  elements.urgencyFilter.value = "all";
  applyFilters();
  document.querySelector("#shipments")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetFilters() {
  state.quickView = "active";
  elements.searchInput.value = "";
  elements.statusFilter.value = "all";
  elements.directionFilter.value = "all";
  elements.urgencyFilter.value = "all";
  elements.ownerFilter.value = "all";
  elements.sortFilter.value = "priority";
  applyFilters();
}

function compareRows(a, b, sortKey) {
  if (sortKey === "eta") return a.etaTimestamp - b.etaTimestamp || b.urgencyRank - a.urgencyRank || b.id - a.id;
  if (sortKey === "newest") return b.id - a.id;
  if (sortKey === "status") return a.status.localeCompare(b.status) || b.urgencyRank - a.urgencyRank || b.id - a.id;
  if (sortKey === "owner") return (a.assignedTeam || "ZZZ Unassigned").localeCompare(b.assignedTeam || "ZZZ Unassigned") || b.urgencyRank - a.urgencyRank || a.etaTimestamp - b.etaTimestamp || b.id - a.id;
  return b.urgencyRank - a.urgencyRank || a.etaTimestamp - b.etaTimestamp || b.id - a.id;
}

function renderMetrics(rows) {
  const metrics = TmaData.computeMetrics(rows);
  elements.activeMetric.textContent = String(metrics.active);
  elements.approvalMetric.textContent = String(metrics.awaiting);
  elements.riskMetric.textContent = String(metrics.risk);
  elements.arrivalMetric.textContent = String(metrics.arrivingWeek);

  elements.statusBreakdown.innerHTML = metrics.statuses.slice(0, 8).map(([status, count]) => {
    const percentage = rows.length ? Math.max(5, Math.round((count / rows.length) * 100)) : 0;
    return `<div class="status-line"><div><span class="status-dot ${statusClass(status)}"></span><strong>${escapeHtml(status)}</strong><b>${count}</b></div><i><span style="width:${percentage}%"></span></i></div>`;
  }).join("") || '<p class="muted">No status data found.</p>';

  const urgentRows = rows
    .filter((row) => row.urgencyRank >= 2)
    .sort((a, b) => b.urgencyRank - a.urgencyRank || a.etaTimestamp - b.etaTimestamp || b.id - a.id);
  elements.urgentQueue.innerHTML = urgentRows.slice(0, 8).map((row) => `
    <button class="urgent-item" data-edit-id="${row.id}">
      <span class="urgency-marker ${urgencyClass(row.urgencyLevel)}">${row.urgencyLevel === "critical" ? "!" : "↑"}</span>
      <span><strong>ID${row.id} · ${escapeHtml(row.origin || "Origin pending")}</strong><small>${escapeHtml(row.urgencyReason)}${row.riskSignalCount > 1 ? ` · +${row.riskSignalCount - 1} signal${row.riskSignalCount > 2 ? "s" : ""}` : ""}</small><em>Owner: ${escapeHtml(row.assignedTeam || "Unassigned")}</em></span>
      <b>Open ›</b>
    </button>`).join("") || '<p class="muted">No Critical or High risk alerts under the current rules.</p>';

  const ownerGroups = new Map();
  for (const row of urgentRows) {
    const owner = row.assignedTeam || "Unassigned";
    ownerGroups.set(owner, (ownerGroups.get(owner) || 0) + 1);
  }
  const ownerRows = [...ownerGroups.entries()].sort(([ownerA, countA], [ownerB, countB]) => {
    if (ownerA === "Unassigned") return -1;
    if (ownerB === "Unassigned") return 1;
    return countB - countA || ownerA.localeCompare(ownerB);
  });
  const maxOwnerRisk = Math.max(1, ...ownerRows.map(([, count]) => count));
  elements.ownerRiskBreakdown.innerHTML = ownerRows.map(([owner, count]) => `
    <button type="button" class="owner-risk-item" data-owner="${escapeHtml(owner === "Unassigned" ? "__unassigned__" : owner)}">
      <span><strong>${escapeHtml(owner)}</strong><b>${count}</b></span><i><span style="width:${Math.max(8, Math.round((count / maxOwnerRisk) * 100))}%"></span></i>
    </button>`).join("") || '<p class="muted">No owner has a Critical or High alert.</p>';
}

function updateFilters(rows) {
  const current = elements.statusFilter.value;
  const statuses = [...new Set(rows.map((row) => row.status).filter(Boolean))].sort();
  elements.statusFilter.innerHTML = '<option value="active">Active shipments</option><option value="all">All statuses</option>' + statuses.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("");
  if (current === "active" || current === "all" || statuses.includes(current)) elements.statusFilter.value = current;

  const currentOwner = elements.ownerFilter.value;
  const owners = [...new Set(rows.map((row) => row.assignedTeam).filter(Boolean))].sort();
  const hasUnassigned = rows.some((row) => !row.assignedTeam);
  elements.ownerFilter.innerHTML = '<option value="all">All owners</option>' + (hasUnassigned ? '<option value="__unassigned__">Unassigned</option>' : "") + owners.map((owner) => `<option value="${escapeHtml(owner)}">${escapeHtml(owner)}</option>`).join("");
  if (currentOwner === "all" || (currentOwner === "__unassigned__" && hasUnassigned) || owners.includes(currentOwner)) elements.ownerFilter.value = currentOwner;
}

function applyFilters() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const status = elements.statusFilter.value;
  const direction = elements.directionFilter.value;
  const urgency = elements.urgencyFilter.value;
  const owner = elements.ownerFilter.value;
  const sortKey = elements.sortFilter.value;

  state.filteredRows = state.rows
    .filter((row) => {
      const haystack = [row.id, row.po, row.container, row.origin, row.discharge, row.carrier, row.shipper, row.vessel, row.booking, row.requestor, row.assignedTeam, row.approvedAgent].join(" ").toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesStatus = status === "all" || (status === "active" && row.active) || row.status === status;
      const matchesDirection = direction === "all" || row.direction.toLowerCase().includes(direction);
      const matchesUrgency = urgency === "all" || (urgency === "urgent" && row.urgencyRank >= 2) || row.urgencyLevel === urgency;
      const matchesOwner = owner === "all" || (owner === "__unassigned__" ? !row.assignedTeam : row.assignedTeam === owner);
      const matchesQuickView = rowMatchesQuickView(row, state.quickView);
      return matchesQuery && matchesStatus && matchesDirection && matchesUrgency && matchesOwner && matchesQuickView;
    })
    .sort((a, b) => {
      if (state.quickView === "missing-info") return b.missingFields.length - a.missingFields.length || compareRows(a, b, sortKey);
      if (state.quickView === "data-issues") return b.dataIssues.length - a.dataIssues.length || compareRows(a, b, sortKey);
      return compareRows(a, b, sortKey);
    });

  updateQuickViewSelection();
  renderRows(state.filteredRows);
}

function renderRows(rows) {
  const visible = rows.slice(0, 100);
  elements.resultCount.textContent = `${rows.length} shipment${rows.length === 1 ? "" : "s"}${rows.length > 100 ? " · showing first 100" : ""}`;

  if (!visible.length) {
    elements.shipmentRows.innerHTML = '<tr><td class="loading-cell" colspan="9">No shipments match these filters.</td></tr>';
    return;
  }

  elements.shipmentRows.innerHTML = visible.map((row) => {
    const itemUrl = `${ITEM_URL_BASE}${row.id}`;
    const owner = row.assignedTeam || "Unassigned";
    const agent = [row.approvedAgent, row.carrier].filter(Boolean).join(" / ") || "No agent assigned";
    const visibleGapLimit = state.quickView === "missing-info" ? 4 : 2;
    const visibleGaps = row.missingFields.slice(0, visibleGapLimit);
    const hiddenGapCount = Math.max(0, row.missingFields.length - visibleGaps.length);
    const gapSummary = `Missing: ${visibleGaps.join(" · ")}${hiddenGapCount ? ` · +${hiddenGapCount}` : ""}`;
    const dataGap = row.hasDataGaps ? `<span class="data-gap-chip" title="${escapeHtml(row.missingFields.join(", "))}">${escapeHtml(gapSummary)}</span>` : '<span class="data-complete-chip">Data ready</span>';
    const issueLabels = row.dataIssues?.map((issue) => issue.label) || [];
    const dataIssue = issueLabels.length
      ? `<span class="data-issue-chip" title="${escapeHtml(row.dataIssues.map((issue) => issue.detail).join(" "))}">Check: ${escapeHtml(issueLabels.slice(0, 2).join(" · "))}${issueLabels.length > 2 ? ` · +${issueLabels.length - 2}` : ""}</span>`
      : "";
    const extraSignals = row.riskSignalCount > 1 ? `<span class="signal-count-chip" title="${escapeHtml(row.riskSignals.slice(1).map((signal) => signal.reason).join("; "))}">+${row.riskSignalCount - 1} signal${row.riskSignalCount > 2 ? "s" : ""}</span>` : "";
    return `<tr class="urgency-row ${urgencyClass(row.urgencyLevel)}">
      <td><a class="item-link" href="${itemUrl}" target="_blank"><strong>ID${row.id || "—"}</strong><small>${escapeHtml(row.po || "No PO")}</small></a><div class="row-badges">${dataGap}${dataIssue}</div></td>
      <td><strong>${escapeHtml(row.origin || "Origin pending")}</strong><small>→ ${escapeHtml(row.discharge || "Destination pending")}</small></td>
      <td><strong>${escapeHtml(row.shipper || "Not entered")}</strong><small>${escapeHtml(row.incoterms || "")}</small></td>
      <td><span class="status-chip ${statusClass(row.status)}">${escapeHtml(row.status)}</span><span class="priority-chip ${urgencyClass(row.urgencyLevel)}">${escapeHtml(row.urgencyReason)}</span>${extraSignals}</td>
      <td><strong>${escapeHtml(row.mode || "—")}</strong><small>${escapeHtml(row.freightType || row.direction || "")}</small></td>
      <td><strong>${escapeHtml(row.container || "—")}</strong><small>${escapeHtml(row.booking || "")}</small></td>
      <td><strong class="owner-name ${row.assignedTeam ? "" : "unassigned"}">${escapeHtml(owner)}</strong><small>${escapeHtml(agent)}</small></td>
      <td><strong>${escapeHtml(row.eta || "Pending")}</strong><small>${row.revisedEtd ? `Revised ETD ${escapeHtml(row.revisedEtd)}` : `ETD ${escapeHtml(row.etd || "Pending")}`}</small></td>
      <td class="sticky-edit-cell"><button class="edit-button" data-edit-id="${row.id}" aria-label="Edit shipment ID${row.id}">Edit</button></td>
    </tr>`;
  }).join("");
}

function renderDataAssurance() {
  const quality = state.sourceQuality || {};
  const source = state.sourceDiagnostics || {};
  const blocked = Number(quality.invalidIdCount || 0) + Number(quality.duplicateRowCount || 0);
  const schemaWarnings = Number(quality.unmappedFields?.length || 0) + Number(quality.lowConfidenceFields?.length || 0);
  const readWarnings = Number(source.personReadFailures || 0) + (source.formattedValuesAvailable === false ? 1 : 0);
  const dataIssues = Number(quality.dataIssueCount || 0);
  const guarded = blocked > 0 || schemaWarnings > 0 || readWarnings > 0 || dataIssues > 0;

  elements.dataAssurance.classList.remove("checking", "warning");
  elements.dataAssurance.classList.toggle("warning", guarded);
  elements.assuranceIcon.textContent = guarded ? "!" : "✓";
  elements.uniqueRecordMetric.textContent = String(quality.rowCount ?? state.rows.length);
  elements.blockedRecordMetric.textContent = String(blocked);
  elements.dataIssueMetric.textContent = String(dataIssues);

  const details = [];
  if (blocked) details.push(`${blocked} duplicate or invalid row${blocked === 1 ? " was" : "s were"} excluded`);
  if (quality.unmappedFields?.length) details.push(`${quality.unmappedFields.length} control-tower field${quality.unmappedFields.length === 1 ? " is" : "s are"} unavailable and dependent checks are suppressed`);
  if (quality.lowConfidenceFields?.length) details.push(`${quality.lowConfidenceFields.length} field mapping${quality.lowConfidenceFields.length === 1 ? " uses" : "s use"} item-key fallback`);
  if (source.formattedValuesAvailable === false) details.push("formatted-value read failed; raw SharePoint values are being used");
  if (source.personReadFailures) details.push("IMPEX Person field could not be expanded; text fallback is being used");
  if (dataIssues) details.push(`${dataIssues} shipment${dataIssues === 1 ? " has" : "s have"} an invalid, ambiguous or conflicting schedule date`);

  elements.assuranceTitle.textContent = guarded ? "Guardrails active — review noted exceptions" : "Source checks passed";
  elements.assuranceDetail.textContent = details.length
    ? `${details.join(" · ")}. Risk rules do not treat unavailable or unreliable dates as confirmed risk.`
    : "Unique IDs confirmed, exact SharePoint schema mapped and raw ISO schedule dates used for risk calculations.";
}

function renderMapping(fieldMap, mappingDiagnostics, fieldDiagnostics, sampleKeys) {
  const labels = {
    po: "Purchase order", status: "Status", assignedTeam: "IMPEX owner", shipper: "Origin shipper", origin: "Origin", discharge: "Discharge", container: "Container", carrier: "Carrier", vessel: "Vessel / flight", booking: "Booking number", telexHbl: "Telex HBL", eta: "ETA", etd: "ETD", revisedEtd: "Revised ETD", direction: "Direction"
  };
  const mapped = Object.entries(labels).map(([key, label]) => {
    const diagnostic = mappingDiagnostics?.[key];
    const confidence = diagnostic?.confidence === "high" ? "exact" : diagnostic?.confidence === "medium" ? "fallback" : "blocked";
    return `${label.padEnd(16)} ${fieldMap[key] || "Not detected"}  [${confidence}]`;
  }).join("\n");
  const available = (fieldDiagnostics || []).slice(0, 60).map((field) => `${field.title || "Untitled"}  →  ${field.internalName || "Unknown"}  (${field.type || "Unknown type"}${field.readOnly ? ", SharePoint read-only" : ""})`).join("\n");
  const keys = (sampleKeys || []).slice(0, 100).join(", ");
  elements.mappingOutput.textContent = `${mapped}\n\nAVAILABLE FIELDS (${fieldDiagnostics.length})\n${available || "No field schema returned"}\n\nSAMPLE ITEM KEYS\n${keys || "No item keys returned"}`;
}

function updateFreshnessLabel() {
  if (!state.fetchedAt || state.loading) return;
  const fetched = new Date(state.fetchedAt);
  const ageMinutes = Math.max(0, Math.floor((Date.now() - fetched.getTime()) / 60000));
  const syncTime = fetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const stale = ageMinutes >= 10;
  elements.syncLabel.className = `sync-label ${stale ? "offline" : "online"}`;
  elements.syncLabel.innerHTML = `<i></i> ${stale ? "Stale" : "Live"} · ${state.rows.length} unique · ${ageMinutes ? `${ageMinutes}m ago` : syncTime} · auto 5m`;
}

async function loadDashboard() {
  const requestId = ++state.loadRequestId;
  state.loading = true;
  elements.syncLabel.className = "sync-label loading";
  elements.syncLabel.innerHTML = "<i></i> Reading SharePoint List";

  const sourceTab = await findSharePointTab();
  if (!sourceTab?.id) {
    if (requestId !== state.loadRequestId) return;
    state.loading = false;
    if (state.hasLoaded) {
      elements.syncLabel.className = "sync-label offline";
      elements.syncLabel.innerHTML = "<i></i> SharePoint tab closed · showing last verified snapshot";
      showToast("SharePoint tab is closed; the dashboard kept the last verified snapshot", 6000, "warning");
    } else {
      showSetup("Open the TMA Freight Request Form in another Edge tab, sign in, then select Try again.");
    }
    return;
  }

  try {
    state.sourceTabId = sourceTab.id;
    const response = await sendToSharePoint({ type: "TMA_GET_LIST_DATA" });
    if (!response?.ok) throw new Error(response?.error || "The SharePoint tab did not return data.");
    if (requestId !== state.loadRequestId) return;

    const transformed = TmaData.transformItems(response.data.items, response.data.fields);
    state.rows = transformed.rows;
    state.fieldMap = transformed.fieldMap;
    state.mappingDiagnostics = transformed.mappingDiagnostics;
    state.fieldDiagnostics = transformed.fieldDiagnostics;
    state.sampleKeys = transformed.sampleKeys;
    state.sourceQuality = transformed.sourceQuality;
    state.sourceDiagnostics = response.data.sourceDiagnostics || {};
    state.writableFields = new Map((response.data.writableFields || []).map((field) => [field.internalName, field]));
    state.writableFieldNames = new Set(state.writableFields.keys());
    state.fetchedAt = response.data.fetchedAt;
    state.hasLoaded = true;
    state.loading = false;

    hideSetup();
    renderMetrics(state.rows);
    updateFilters(state.rows);
    renderQuickViews(state.rows);
    renderDataAssurance();
    renderMapping(state.fieldMap, state.mappingDiagnostics, state.fieldDiagnostics, state.sampleKeys);
    applyFilters();
    updateFreshnessLabel();
  } catch (error) {
    if (requestId !== state.loadRequestId) return;
    state.loading = false;
    if (state.hasLoaded) {
      elements.syncLabel.className = "sync-label offline";
      elements.syncLabel.innerHTML = "<i></i> Refresh failed · showing last verified snapshot";
      showToast(`Refresh failed: ${error.message}`, 7000, "warning");
    } else {
      showSetup(`Connection failed: ${error.message}. Refresh the SharePoint List tab once, then try again.`);
    }
  }
}

function truthySharePointValue(value) {
  return ["yes", "true", "1", "checked"].includes(String(value || "").toLowerCase());
}

function setEditorFieldAvailability() {
  const supportedTypes = new Set(["text", "note", "choice", "datetime", "boolean"]);
  for (const definition of editorFields) {
    const internalName = state.fieldMap[definition.key];
    const diagnostic = state.fieldDiagnostics.find((field) => field.internalName === internalName);
    const schemaWritable = Boolean(diagnostic && !diagnostic.readOnly && supportedTypes.has(String(diagnostic.type || "").toLowerCase()));
    const bridgeApproved = Boolean(internalName && state.writableFieldNames.has(internalName));
    const writable = Boolean(internalName && bridgeApproved && schemaWritable);
    definition.element.disabled = !writable;
    definition.element.closest("label")?.classList.toggle("field-unavailable", !writable);
    if (definition.key === "vessel") {
      let reason = "";
      if (!internalName) reason = "Vessel / Flight Name column was not detected in SharePoint.";
      else if (diagnostic?.readOnly) reason = "SharePoint reports this column as read-only.";
      else if (diagnostic && !supportedTypes.has(String(diagnostic.type || "").toLowerCase())) reason = `SharePoint column type ${diagnostic.type || "Unknown"} cannot accept plain text here.`;
      else if (!writable) reason = "This field was not returned as writable. Refresh the SharePoint List tab, then refresh this dashboard.";
      elements.editVesselReason.textContent = reason;
      elements.editVesselReason.classList.toggle("hidden", !reason);
    }
  }
}

function renderEditorOverview(row) {
  const carrier = [row.approvedAgent, row.carrier].filter(Boolean).join(" / ") || "Not assigned";
  const mode = [row.mode, row.freightType].filter(Boolean).join(" / ") || "Pending";
  const signals = row.riskSignals?.length
    ? `<div class="overview-risk-list">${row.riskSignals.map((signal) => `<article class="${urgencyClass(signal.level)}"><span>${escapeHtml(signal.level)}</span><div><strong>${escapeHtml(signal.reason)}</strong><p>${escapeHtml(signal.action)}</p></div></article>`).join("")}</div>`
    : '<div class="overview-ready">✓ No current risk signal under the control-tower rules</div>';
  const gaps = row.missingFields?.length
    ? `<div class="overview-gaps"><strong>Information to complete</strong><div>${row.missingFields.map((field) => `<span>${escapeHtml(field)}</span>`).join("")}</div></div>`
    : '<div class="overview-ready">✓ Key operational information is complete</div>';
  const dataChecks = row.dataIssues?.length
    ? `<div class="overview-gaps"><strong>Schedule data to verify</strong><div>${row.dataIssues.map((issue) => `<span title="${escapeHtml(issue.detail)}">${escapeHtml(issue.label)}</span>`).join("")}</div></div>`
    : "";

  elements.shipmentOverview.innerHTML = `
    <div class="overview-title-row"><div><span>RISK SIGNALS</span><strong>${row.riskSignalCount || 0} detected</strong></div><div><span>IMPEX OWNER</span><strong class="${row.assignedTeam ? "" : "unassigned"}">${escapeHtml(row.assignedTeam || "Unassigned")}</strong></div></div>
    ${signals}
    <div class="overview-grid">
      <div><span>Route</span><strong>${escapeHtml(row.origin || "Origin pending")} → ${escapeHtml(row.discharge || "Destination pending")}</strong></div>
      <div><span>Origin shipper</span><strong>${escapeHtml(row.shipper || "Not entered")}</strong></div>
      <div><span>Mode</span><strong>${escapeHtml(mode)}</strong></div>
      <div><span>Agent / carrier</span><strong>${escapeHtml(carrier)}</strong></div>
      <div><span>Container</span><strong>${escapeHtml(row.container || "Pending")}</strong></div>
      <div><span>ETA</span><strong>${escapeHtml(row.eta || "Pending")}</strong></div>
    </div>
    ${gaps}
    ${dataChecks}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

function openEditor(row) {
  if (!row) return;
  state.editingRow = row;
  state.pendingChanges = [];
  elements.editorSummary.textContent = `ID${row.id} · ${row.po || "No PO"} · ${row.origin || "Origin pending"} → ${row.discharge || "Destination pending"}`;
  renderEditorOverview(row);

  const statusInternalName = state.fieldMap.status;
  const configuredChoices = state.writableFields.get(statusInternalName)?.choices || [];
  const statuses = [...new Set((configuredChoices.length ? configuredChoices : state.rows.map((item) => item.status)).filter(Boolean))].sort();
  if (!statuses.includes(row.status)) statuses.unshift(row.status);
  elements.editStatus.innerHTML = statuses.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join("");
  elements.editStatus.value = row.status;
  elements.editCargoReady.value = row.cargoReadyInput || "";
  elements.editEtd.value = row.etdInput || "";
  elements.editRevisedEtd.value = row.revisedEtdInput || "";
  elements.editEta.value = row.etaInput || "";
  elements.editShipper.value = row.shipper || "";
  elements.editOrigin.value = row.origin || "";
  elements.editDischarge.value = row.discharge || "";
  elements.editContainer.value = row.container || "";
  elements.editVessel.value = row.vessel || "";
  elements.editBooking.value = row.booking || "";
  elements.editTelexHbl.checked = truthySharePointValue(row.telexHbl);
  setEditorFieldAvailability();

  elements.saveError.classList.add("hidden");
  elements.editValidation.classList.add("hidden");
  elements.editForm.classList.remove("hidden");
  elements.confirmPanel.classList.add("hidden");
  elements.editorBackdrop.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeEditor() {
  if (state.saving) return;
  elements.editorBackdrop.classList.add("hidden");
  document.body.style.overflow = "";
  state.editingRow = null;
  state.pendingChanges = [];
}

function dateDisplay(value) {
  if (!value) return "Blank";
  return TmaData.formatDate(TmaData.parseDate(`${value}T00:00:00Z`), value);
}

function readEditorValue(definition) {
  if (definition.type === "boolean") return definition.element.checked;
  return definition.element.value.trim();
}

function currentEditorValue(row, definition) {
  if (definition.type === "boolean") return truthySharePointValue(row[definition.valueKey]);
  return String(row[definition.valueKey] || "").trim();
}

function toSharePointValue(definition, value) {
  if (definition.type === "date") return value ? `${value}T00:00:00Z` : null;
  if (definition.type === "boolean") return Boolean(value);
  return value;
}

function displayEditorValue(definition, value) {
  if (definition.type === "date") return dateDisplay(value);
  if (definition.type === "boolean") return value ? "Yes" : "No";
  return value || "Blank";
}

function collectChanges() {
  const row = state.editingRow;
  if (!row) return [];
  const changes = [];
  for (const definition of editorFields) {
    const internalName = state.fieldMap[definition.key];
    if (!internalName || !state.writableFieldNames.has(internalName) || definition.element.disabled) continue;
    const oldValue = currentEditorValue(row, definition);
    const newValue = readEditorValue(definition);
    if (oldValue === newValue) continue;
    changes.push({
      key: definition.key,
      label: definition.label,
      internalName,
      oldDisplay: displayEditorValue(definition, oldValue),
      newDisplay: displayEditorValue(definition, newValue),
      value: toSharePointValue(definition, newValue)
    });
  }
  return changes;
}

function validateProposedChanges(changes) {
  if (!changes.length) return "";
  for (const change of changes) {
    const schema = state.writableFields.get(change.internalName);
    if (String(schema?.type || "").toLowerCase() === "text" && String(change.value || "").length > 255) {
      return `${change.label} exceeds the 255-character SharePoint Text limit.`;
    }
  }

  const changedKeys = new Set(changes.map((change) => change.key));
  if (!["cargoReady", "etd", "revisedEtd", "eta"].some((key) => changedKeys.has(key))) return "";
  const proposal = {
    cargoReady: elements.editCargoReady.value,
    etd: elements.editEtd.value,
    revisedEtd: elements.editRevisedEtd.value,
    eta: elements.editEta.value
  };
  const effectiveEtd = proposal.revisedEtd || proposal.etd;
  if (proposal.cargoReady && effectiveEtd && proposal.cargoReady > effectiveEtd) {
    return "Cargo Ready Date cannot be later than the effective ETD. Verify the dates before writing to SharePoint.";
  }
  if (proposal.eta && effectiveEtd && proposal.eta < effectiveEtd) {
    return "Vessel/Flight ETA cannot be earlier than the effective ETD. Verify the dates before writing to SharePoint.";
  }
  return "";
}

function reviewChanges(event) {
  event.preventDefault();
  const changes = collectChanges();
  if (!changes.length) {
    showToast("No changes to review");
    return;
  }
  const validationError = validateProposedChanges(changes);
  if (validationError) {
    elements.editValidation.textContent = validationError;
    elements.editValidation.classList.remove("hidden");
    return;
  }
  elements.editValidation.classList.add("hidden");
  state.pendingChanges = changes;
  elements.changeList.innerHTML = changes.map((change) => `<article><strong>${escapeHtml(change.label)}</strong><div><span>${escapeHtml(change.oldDisplay)}</span><b>→</b><span>${escapeHtml(change.newDisplay)}</span></div></article>`).join("");
  elements.editForm.classList.add("hidden");
  elements.confirmPanel.classList.remove("hidden");
  elements.saveError.classList.add("hidden");
}

async function confirmUpdate() {
  if (!state.editingRow || !state.pendingChanges.length || state.saving) return;
  state.saving = true;
  elements.confirmUpdateButton.disabled = true;
  elements.confirmUpdateButton.textContent = "Updating SharePoint…";
  elements.saveError.classList.add("hidden");

  try {
    const response = await sendToSharePoint({
      type: "TMA_UPDATE_LIST_ITEM",
      itemId: state.editingRow.id,
      etag: state.editingRow.etag,
      modified: state.editingRow.modified,
      updates: state.pendingChanges.map(({ internalName, value }) => ({ internalName, value }))
    });
    if (!response?.ok) throw new Error(response?.error || "SharePoint did not confirm the update.");

    const updatedId = state.editingRow.id;
    state.saving = false;
    elements.confirmUpdateButton.disabled = false;
    elements.confirmUpdateButton.textContent = "Confirm update";
    const verified = response.result?.verified !== false;
    const mismatches = response.result?.verificationMismatches || [];
    const verificationError = response.result?.verificationError || "";
    closeEditor();
    await loadDashboard();
    if (verified) {
      showToast(`ID${updatedId} updated and verified in SharePoint`, 4500);
    } else {
      const verificationDetail = verificationError ? "the verification read could not complete" : `${mismatches.join(", ") || "one or more fields"} did not match`;
      showToast(`ID${updatedId} was accepted by SharePoint, but ${verificationDetail}. Check the refreshed record before another edit; do not repeat the update blindly.`, 9000, "warning");
    }
  } catch (error) {
    state.saving = false;
    elements.confirmUpdateButton.disabled = false;
    elements.confirmUpdateButton.textContent = "Confirm update";
    elements.saveError.textContent = error.message;
    elements.saveError.classList.remove("hidden");
  }
}

function exportCsv() {
  if (!state.filteredRows.length) {
    showToast("No visible shipments to export");
    return;
  }

  const headers = ["ID", "PO", "IMPEX Owner", "Risk level", "Primary risk", "All risk signals", "Recommended action", "Data gaps", "Origin", "Discharge", "Origin Shipper", "Status", "Mode", "Freight Type", "Container", "Agent", "Carrier", "Vessel/Flight", "Cargo Ready", "ETD", "Revised ETD", "ETA", "Direction", "LC Number"];
  const lines = [headers.map(TmaData.csvCell).join(",")];
  for (const row of state.filteredRows) {
    lines.push([row.id, row.po, row.assignedTeam || "Unassigned", row.urgencyLevel, row.urgencyReason, row.riskSignals.map((signal) => signal.reason).join("; "), row.urgencyAction, row.missingFields.join("; "), row.origin, row.discharge, row.shipper, row.status, row.mode, row.freightType, row.container, row.approvedAgent, row.carrier, row.vessel, row.cargoReady, row.etd, row.revisedEtd, row.eta, row.direction, row.lc].map(TmaData.csvCell).join(","));
  }

  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `TMA-Logistics-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Visible shipments exported");
}

document.querySelector("#openListButton").addEventListener("click", () => chrome.tabs.create({ url: LIST_URL }));
document.querySelector("#setupOpenButton").addEventListener("click", () => chrome.tabs.create({ url: LIST_URL }));
document.querySelector("#newRequestButton").addEventListener("click", () => chrome.tabs.create({ url: NEW_ITEM_URL }));
document.querySelector("#refreshButton").addEventListener("click", loadDashboard);
document.querySelector("#setupRetryButton").addEventListener("click", loadDashboard);
document.querySelector("#exportButton").addEventListener("click", exportCsv);
document.querySelector("#copyBriefButton").addEventListener("click", async () => {
  const copied = await copyText(TmaData.buildRiskHandoff(state.rows, sydneyDateLabel()));
  showToast(copied ? "Risk Handoff copied" : "Unable to copy Risk Handoff");
});
document.querySelector("#clearFiltersButton").addEventListener("click", resetFilters);
document.querySelector("#reviewDataChecksButton").addEventListener("click", () => selectQuickView("data-issues"));
let searchTimer = null;
elements.searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(applyFilters, 180);
});
elements.statusFilter.addEventListener("change", () => {
  state.quickView = "all";
  applyFilters();
});
elements.directionFilter.addEventListener("change", applyFilters);
elements.ownerFilter.addEventListener("change", applyFilters);
elements.urgencyFilter.addEventListener("change", () => {
  state.quickView = "all";
  if (elements.urgencyFilter.value !== "all") elements.statusFilter.value = "all";
  applyFilters();
});
elements.sortFilter.addEventListener("change", applyFilters);
elements.quickViews.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quick-view]");
  if (button) selectQuickView(button.dataset.quickView);
});
document.querySelector(".kpi-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-quick-view]");
  if (button) selectQuickView(button.dataset.quickView);
});
elements.shipmentRows.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-edit-id]");
  if (!button) return;
  openEditor(state.rows.find((row) => row.id === Number(button.dataset.editId)));
});
elements.urgentQueue.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-id]");
  if (!button) return;
  openEditor(state.rows.find((row) => row.id === Number(button.dataset.editId)));
});
elements.ownerRiskBreakdown.addEventListener("click", (event) => {
  const button = event.target.closest("[data-owner]");
  if (!button) return;
  state.quickView = "all-risk";
  elements.statusFilter.value = "all";
  elements.urgencyFilter.value = "urgent";
  elements.ownerFilter.value = button.dataset.owner;
  applyFilters();
  document.querySelector("#shipments")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
elements.editForm.addEventListener("submit", reviewChanges);
elements.copyFollowUpButton.addEventListener("click", async () => {
  if (!state.editingRow) return;
  const copied = await copyText(TmaData.buildFollowUpMessage(state.editingRow));
  showToast(copied ? "Follow-up message copied" : "Unable to copy follow-up message");
});
elements.copySummaryButton.addEventListener("click", async () => {
  if (!state.editingRow) return;
  const copied = await copyText(TmaData.buildShipmentSummary(state.editingRow));
  showToast(copied ? "Shipment summary copied" : "Unable to copy summary");
});
elements.openRecordButton.addEventListener("click", () => {
  if (state.editingRow) chrome.tabs.create({ url: `${ITEM_URL_BASE}${state.editingRow.id}` });
});
document.querySelector("#editorCloseButton").addEventListener("click", closeEditor);
document.querySelector("#editorCancelButton").addEventListener("click", closeEditor);
document.querySelector("#backToEditButton").addEventListener("click", () => {
  elements.confirmPanel.classList.add("hidden");
  elements.editForm.classList.remove("hidden");
});
elements.confirmUpdateButton.addEventListener("click", confirmUpdate);
elements.editorBackdrop.addEventListener("mousedown", (event) => {
  if (event.target === elements.editorBackdrop) closeEditor();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.editorBackdrop.classList.contains("hidden")) closeEditor();
});

document.querySelector("#todayLabel").textContent = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "Australia/Sydney" }).format(new Date()).toUpperCase();
document.querySelector("#versionLabel").textContent = `v${chrome.runtime.getManifest().version}`;
loadDashboard();
window.setInterval(updateFreshnessLabel, 30000);

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
function refreshAllowed() {
  return document.visibilityState === "visible" && elements.editorBackdrop.classList.contains("hidden") && !state.loading;
}
window.setInterval(() => {
  if (refreshAllowed()) loadDashboard();
}, REFRESH_INTERVAL_MS);
document.addEventListener("visibilitychange", () => {
  if (!refreshAllowed() || !state.hasLoaded) return;
  updateFreshnessLabel();
  const ageMs = state.fetchedAt ? Date.now() - new Date(state.fetchedAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (ageMs >= REFRESH_INTERVAL_MS) loadDashboard();
});
