import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./shared.js", import.meta.url), "utf8");
const context = vm.createContext({ console });
vm.runInContext(source, context);
const { TmaData } = context;

const sharePointUtcDate = TmaData.parseDateInfo("2026-07-05T14:00:00Z");
assert.equal(TmaData.formatDate(sharePointUtcDate.date), "6 Jul 2026", "SharePoint UTC timestamps must resolve to the Sydney calendar date");
assert.equal(TmaData.parseDateInfo("2026-02-31").state, "invalid", "impossible calendar dates must be rejected instead of rolled into March");

const fields = [
  { Title: "TMA Purchase Order Number", InternalName: "TMA_x0020_PO", Hidden: false },
  { Title: "Assigned Impex Team", InternalName: "OldAssignedTeam", Hidden: false },
  { Title: "Assigned IMPEX Team Member", InternalName: "AssignedTeamMember", Hidden: false },
  { Title: "Incoterms", InternalName: "Incoterms", Hidden: false },
  { Title: "Cargo Ready Date", InternalName: "CargoReady", Hidden: false },
  { Title: "Port of Origin", InternalName: "Origin", Hidden: false },
  { Title: "Port of Discharge", InternalName: "Discharge", Hidden: false },
  { Title: "Origin Shipper Name", InternalName: "OriginShipper", Hidden: false },
  { Title: "Vessel/Flight ETA", InternalName: "ETA", Hidden: false },
  { Title: "Vessel/Flight ETD", InternalName: "ETD", Hidden: false },
  { Title: "revised ETD", InternalName: "RevisedETD", Hidden: false },
  { Title: "Status", InternalName: "Status", Hidden: false },
  { Title: "Container#", InternalName: "Container", Hidden: false }
];

const items = [
  { ID: 451, ETA: "2026-07-13T00:00:00Z", ETD: "2026-07-10T00:00:00Z", FieldValuesAsText: { TMA_x0020_PO: "Q307507", OldAssignedTeam: "", AssignedTeamMember: "James Saquilabon", Origin: "Auburn", Discharge: "Poland", OriginShipper: "TMA TECH - QLD", ETA: "13/07/2026", ETD: "10/07/2026", RevisedETD: "", Status: "Booking complete", Container: "MSCU1234567" } },
  { ID: 374, ETA: "2026-07-09T00:00:00Z", ETD: "2026-06-12T00:00:00Z", RevisedETD: "2026-06-19T00:00:00Z", FieldValuesAsText: { TMA_x0020_PO: "PUR0026433", OldAssignedTeam: "", AssignedTeamMember: "Pennie Tamorada", Origin: "Shanghai, China", Discharge: "Melbourne, VIC", OriginShipper: "Zhejiang Shanghong", ETA: "09/07/2026", ETD: "12/06/2026", RevisedETD: "19/06/2026", Status: "In transit", Container: "GAOU7432250" } }
];

const transformed = TmaData.transformItems(items, fields, "2026-07-11T00:00:00+10:00");
assert.equal(transformed.fieldMap.po, "TMA_x0020_PO");
assert.equal(transformed.fieldMap.assignedTeam, "AssignedTeamMember");
assert.equal(transformed.rows[1].assignedTeam, "Pennie Tamorada");
assert.equal(transformed.rows[0].origin, "Auburn");
assert.equal(transformed.rows[0].shipper, "TMA TECH - QLD");
assert.equal(transformed.rows[0].arrivingSoon, true);
assert.equal(transformed.rows[1].isRisk, true);
assert.equal(transformed.rows[1].urgencyLevel, "critical");
assert.equal(transformed.rows[1].urgencyRule, "ETA tracking");
assert.equal(transformed.rows[0].eta, "13 Jul 2026");
assert.equal(transformed.rows[0].hasDataGaps, false);
assert.ok(!transformed.rows[0].missingFields.includes("Agent / carrier"), "unavailable schema must not create a false missing-field alert");
assert.ok(!transformed.rows[1].missingFields.includes("Vessel / flight"), "unavailable schema must not create a false missing-field alert");
assert.ok(!transformed.rows[1].missingFields.includes("Assigned IMPEX Team Member"));
const copiedSummary = TmaData.buildShipmentSummary(transformed.rows[1]);
assert.match(copiedSummary, /TMA Freight ID374/);
assert.match(copiedSummary, /Zhejiang Shanghong/);
assert.match(copiedSummary, /ETA overdue/);

const expandedPerson = TmaData.transformItems(
  [{ ID: 452, AssignedTeamMember: { Title: "Pennie Tamorada" }, FieldValuesAsText: { AssignedTeamMember: "", Status: "In transit", ETA: "" } }],
  [
    { Title: "Assigned IMPEX Team Member", InternalName: "AssignedTeamMember", TypeAsString: "User", Hidden: false },
    { Title: "Status", InternalName: "Status", Hidden: false },
    { Title: "Vessel/Flight ETA", InternalName: "ETA", Hidden: false }
  ],
  "2026-07-11T00:00:00+10:00"
);
assert.equal(expandedPerson.rows[0].assignedTeam, "Pennie Tamorada", "expanded Person value must win when FieldValuesAsText is blank");

const encodedFields = [
  { Title: "Port of Origin", InternalName: "Port_x0020_of_x0020_Origin", Hidden: "false" },
  { Title: "Status", InternalName: "Status0", Hidden: "false" }
];
const encodedItems = [{ ID: 1, Port_x0020_of_x0020_Origin: "Shanghai, China", Status0: "In transit" }];
const encoded = TmaData.transformItems(encodedItems, encodedFields, "2026-07-11T00:00:00+10:00");
assert.equal(encoded.rows[0].origin, "Shanghai, China");
assert.equal(encoded.rows[0].status, "In transit");

const metrics = TmaData.computeMetrics(transformed.rows);
assert.equal(metrics.active, 2);
assert.equal(metrics.risk, 1);
assert.equal(metrics.arrivingWeek, 1);

const statusItems = [
  { ID: 1, Status: "In transit", ETA: "2026-07-20T00:00:00Z" },
  { ID: 2, Status: "Booking complete", ETA: "2026-07-21T00:00:00Z" },
  { ID: 3, Status: "Booking Sent to Agent", ETA: "2026-07-22T00:00:00Z" },
  { ID: 4, Status: "Quote Complete", ETA: "" },
  { ID: 5, Status: "Quote In Progress", ETA: "" },
  { ID: 6, Status: "Delivered", ETA: "2026-07-01T00:00:00Z" }
];
const statusFields = [
  { Title: "Status", InternalName: "Status", Hidden: false },
  { Title: "Vessel/Flight ETA", InternalName: "ETA", Hidden: false }
];
const statusTransformed = TmaData.transformItems(statusItems, statusFields, "2026-07-11T00:00:00+10:00");
const statusMetrics = TmaData.computeMetrics(statusTransformed.rows);
assert.equal(statusMetrics.active, 3);
assert.equal(statusMetrics.awaiting, 1);

const unavailableEta = TmaData.transformItems(
  [{ ID: 21, Status: "In transit" }],
  [{ Title: "Status", InternalName: "Status", Hidden: false }],
  "2026-07-11T00:00:00+10:00"
);
assert.equal(unavailableEta.rows[0].urgencyLevel, "normal", "an unavailable ETA column must not mark every in-transit record as ETA missing");
assert.ok(!unavailableEta.rows[0].missingFields.includes("ETA"));
assert.ok(unavailableEta.sourceQuality.unmappedFields.includes("Vessel/Flight ETA"));

const ambiguousEta = TmaData.transformItems(
  [{ ID: 22, Status: "In transit", ETA: "7/9/2026" }],
  [
    { Title: "Status", InternalName: "Status", Hidden: false },
    { Title: "Vessel/Flight ETA", InternalName: "ETA", Hidden: false }
  ],
  "2026-07-11T00:00:00+10:00"
);
assert.equal(ambiguousEta.rows[0].urgencyLevel, "normal", "ambiguous local date text must not generate a confirmed overdue alert");
assert.equal(ambiguousEta.rows[0].arrivingSoon, false);
assert.ok(ambiguousEta.rows[0].dataIssues.some((issue) => issue.code === "eta_ambiguous"));
assert.equal(ambiguousEta.rows[0].etaInput, "", "ambiguous dates must not be prefilled into the writeback date input");

const scheduleConflict = TmaData.transformItems(
  [
    { ID: 23, Status: "Booking complete", ETD: "2026-07-16T00:00:00Z", ETA: "2026-07-15T00:00:00Z" },
    { ID: 23, Status: "Booking complete", ETD: "2026-07-16T00:00:00Z", ETA: "2026-07-15T00:00:00Z" },
    { ID: 0, Status: "In transit" }
  ],
  [
    { Title: "Status", InternalName: "Status", Hidden: false },
    { Title: "Vessel/Flight ETD", InternalName: "ETD", Hidden: false },
    { Title: "Vessel/Flight ETA", InternalName: "ETA", Hidden: false }
  ],
  "2026-07-11T00:00:00+10:00"
);
assert.equal(scheduleConflict.rows.length, 1);
assert.equal(scheduleConflict.sourceQuality.duplicateRowCount, 1);
assert.equal(scheduleConflict.sourceQuality.invalidIdCount, 1);
assert.ok(scheduleConflict.rows[0].dataIssues.some((issue) => issue.code === "eta_before_etd"));

const ambiguousSchema = TmaData.buildFieldResolution([
  { Title: "Vessel/Flight ETA", InternalName: "ETA1", Hidden: false },
  { Title: "Vessel/Flight ETA", InternalName: "ETA2", Hidden: false }
], [{ ID: 24 }]);
assert.equal(ambiguousSchema.fieldMap.eta, "");
assert.equal(ambiguousSchema.mappingDiagnostics.eta.method, "ambiguous");

const urgencyItems = [
  { ID: 10, Status: "In transit", ETA: "2026-07-09T00:00:00Z", Incoterms: "FOB - Free On Board", ETD: "2026-07-01T00:00:00Z", RevisedETD: "2026-07-05T00:00:00Z", AssignedTeam: "James Saquilabon" },
  { ID: 11, Status: "Booking complete", ETA: "2026-07-30T00:00:00Z", Incoterms: "FOB - Free On Board", ETD: "2026-07-01T00:00:00Z", RevisedETD: "2026-07-05T00:00:00Z", AssignedTeam: "James Saquilabon" },
  { ID: 12, Status: "New Request", CargoReady: "2026-07-11T00:00:00Z" },
  { ID: 13, Status: "Booking Sent to Agent", ETA: "2026-07-12T00:00:00Z" },
  { ID: 14, Status: "Delivered", ETA: "2026-07-01T00:00:00Z", Incoterms: "FOB", ETD: "2026-06-01T00:00:00Z", RevisedETD: "2026-06-05T00:00:00Z" },
  { ID: 15, Status: "In transit", ETA: "2026-07-20T00:00:00Z", Incoterms: "FOB", ETD: "2026-06-01T00:00:00Z", RevisedETD: "2026-06-05T00:00:00Z" },
  { ID: 16, Status: "In transit", ETA: "", AssignedTeam: "Pennie Tamorada" },
  { ID: 17, Status: "In transit", ETA: "2026-07-14T00:00:00Z", Mode: "Sea freight", Direction: "Inbound Freight", TelexHBL: "No", AssignedTeam: "James Saquilabon" },
  { ID: 18, Status: "Booking complete", ETD: "2026-07-13T00:00:00Z", Booking: "", Vessel: "", AssignedTeam: "Pennie Tamorada" }
];
const urgencyFields = [
  { Title: "Status", InternalName: "Status", Hidden: false },
  { Title: "Incoterms", InternalName: "Incoterms", Hidden: false },
  { Title: "Cargo Ready Date", InternalName: "CargoReady", Hidden: false },
  { Title: "Vessel/Flight ETD", InternalName: "ETD", Hidden: false },
  { Title: "revised ETD", InternalName: "RevisedETD", Hidden: false },
  { Title: "Vessel/Flight ETA", InternalName: "ETA", Hidden: false },
  { Title: "Assigned Impex Team", InternalName: "AssignedTeam", Hidden: false },
  { Title: "Airfreight or Sea Freight", InternalName: "Mode", Hidden: false },
  { Title: "Inbound/Outbound", InternalName: "Direction", Hidden: false },
  { Title: "Telex-released HBL", InternalName: "TelexHBL", Hidden: false },
  { Title: "Booking Number SO#", InternalName: "Booking", Hidden: false },
  { Title: "Vessel/Flight Name", InternalName: "Vessel", Hidden: false }
];
const urgent = TmaData.transformItems(urgencyItems, urgencyFields, "2026-07-11T00:00:00+10:00").rows;
assert.deepEqual(Array.from(urgent, (row) => row.urgencyLevel), ["critical", "high", "high", "watch", "normal", "watch", "high", "high", "high"]);
assert.deepEqual(Array.from(urgent, (row) => row.urgencyRule), ["ETA tracking", "ETD tracking", "Booking pending", "Arrival watch", "Normal", "Schedule change", "ETA data quality", "HBL release readiness", "Departure readiness"]);
assert.equal(TmaData.computeMetrics(urgent).risk, 6);
assert.ok(urgent[0].riskSignals.some((signal) => signal.code === "eta_overdue"));
assert.ok(urgent[6].riskSignals.some((signal) => signal.code === "eta_missing"));
assert.ok(urgent[7].riskSignals.some((signal) => signal.code === "hbl_release"));
assert.ok(urgent[8].riskSignals.some((signal) => signal.code === "departure_readiness"));
assert.ok(urgent[5].riskSignals.some((signal) => signal.code === "schedule_slip"));
const riskHandoff = TmaData.buildRiskHandoff(urgent, "11 Jul 2026");
assert.match(riskHandoff, /TMA Logistics Risk Handoff/);
assert.match(riskHandoff, /James Saquilabon \(3\)/);
assert.match(riskHandoff, /Pennie Tamorada \(2\)/);
assert.match(riskHandoff, /Unassigned \(1\)/);
assert.match(riskHandoff, /Action:/);
const followUpMessage = TmaData.buildFollowUpMessage(urgent[7]);
assert.match(followUpMessage, /Hi James,/);
assert.match(followUpMessage, /HBL not released/);
assert.match(followUpMessage, /Required action:/);

const html = fs.readFileSync(new URL("./dashboard.html", import.meta.url), "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "dashboard IDs must be unique");
const dashboardSource = fs.readFileSync(new URL("./dashboard.js", import.meta.url), "utf8");
for (const [, id] of dashboardSource.matchAll(/querySelector\("#([^"]+)"\)/g)) {
  assert.ok(ids.includes(id), `dashboard.js references missing #${id}`);
}
assert.match(html, /WORK VIEWS/);
assert.match(html, /Copy shipment summary/);
assert.match(html, /Copy follow-up message/);
assert.match(html, /Copy Risk Handoff/);
assert.match(html, /Risk by owner/);
assert.match(html, /Checking source integrity/);
assert.match(html, /Review data checks/);
assert.doesNotMatch(html, /My follow-up/);
assert.doesNotMatch(html, /Watchlist/);
assert.match(dashboardSource, /missing-info/);
assert.match(dashboardSource, /Missing: \$\{visibleGaps\.join/);
assert.match(dashboardSource, /b\.missingFields\.length - a\.missingFields\.length/);
assert.match(dashboardSource, /TmaData\.buildShipmentSummary/);
assert.match(dashboardSource, /TmaData\.buildRiskHandoff/);
assert.match(dashboardSource, /TmaData\.buildFollowUpMessage/);
assert.match(dashboardSource, /updated and verified in SharePoint/);
assert.match(dashboardSource, /data-issues/);
assert.doesNotMatch(dashboardSource, /PERSONAL_STORAGE_KEY/);

assert.equal(TmaData.csvCell("Melbourne, VIC"), '"Melbourne, VIC"');
assert.equal(TmaData.csvCell('He said "go"'), '"He said ""go"""');
assert.equal(TmaData.csvCell("=HYPERLINK(\"http://x\")"), '"\'=HYPERLINK(""http://x"")"', "leading formula characters must be neutralised so Excel treats the cell as text");
assert.equal(TmaData.csvCell("+61 400 000 000"), '"\'+61 400 000 000"');

assert.match(dashboardSource, /visibilitychange/, "the dashboard must refresh stale data when it becomes visible again");
assert.match(dashboardSource, /discarded/, "the dashboard must wake a sleeping SharePoint tab before reading or saving");
assert.match(dashboardSource, /clearTimeout\(searchTimer\)/, "search input must be debounced");

const manifest = JSON.parse(fs.readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
assert.equal(manifest.version, "1.6.0");
assert.ok(!manifest.permissions.includes("storage"));
for (const size of [16, 32, 48, 128]) {
  const iconPath = manifest.icons?.[String(size)];
  assert.ok(iconPath, `manifest must declare a ${size}px icon`);
  assert.equal(manifest.action?.default_icon?.[String(size)], iconPath, `action must reuse the ${size}px icon`);
  const icon = fs.readFileSync(new URL(`./${iconPath}`, import.meta.url));
  assert.equal(icon.subarray(1, 4).toString("ascii"), "PNG", `${iconPath} must be a PNG file`);
}

const contentSource = fs.readFileSync(new URL("./content.js", import.meta.url), "utf8");
assert.match(contentSource, /verificationMismatches/);
assert.doesNotMatch(contentSource, /"IF-MATCH": message\.etag \|\| "\*"/);
let messageListener;
const requests = [];
let failVerificationRead = false;
let conflictOnWrite = false;
function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json" : null },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}
const bridgeContext = vm.createContext({
  console,
  Date,
  location: {
    origin: "https://tmaaust-my.sharepoint.com",
    pathname: "/personal/sharepoint_admin_tmagroup_com_au/Lists/TMA%20Freight%20Request%20Form/AllItems.aspx",
    href: "https://tmaaust-my.sharepoint.com/personal/sharepoint_admin_tmagroup_com_au/Lists/TMA%20Freight%20Request%20Form/AllItems.aspx"
  },
  chrome: { runtime: { onMessage: { addListener: (listener) => { messageListener = listener; } } } },
  fetch: async (url, options = {}) => {
    requests.push({ url, options });
    if (url.includes("/fields?")) return jsonResponse({ value: [
      { Title: "Status", InternalName: "Status", TypeAsString: "Choice", Hidden: false, ReadOnlyField: false, Required: true },
      { Title: "Origin Shipper Name", InternalName: "OriginShipper", TypeAsString: "Text", Hidden: false, ReadOnlyField: false, Required: false },
      { Title: "Vessel/Flight ETA", InternalName: "ETA", TypeAsString: "DateTime", Hidden: false, ReadOnlyField: false, Required: false },
      { Title: "Vessel  ／  Flight — Name", InternalName: "VesselName", TypeAsString: "Text", Hidden: false, ReadOnlyField: false, Required: false },
      { Title: "Assigned IMPEX Team Member", InternalName: "AssignedTeamMember", TypeAsString: "User", Hidden: false, ReadOnlyField: false, Required: false },
      { Title: "Telex-released HBL", InternalName: "TelexHBL", TypeAsString: "Boolean", Hidden: false, ReadOnlyField: false, Required: false },
      { Title: "Title", InternalName: "Title", TypeAsString: "Text", Hidden: false, ReadOnlyField: false, Required: false }
    ] });
    if (url.includes("?$select=ListItemEntityTypeFullName")) return jsonResponse({ ListItemEntityTypeFullName: "SP.Data.TMAFreightRequestFormListItem" });
    if (url.includes("$select=ID,AssignedTeamMember/Title")) return jsonResponse({ value: [{ ID: 7, AssignedTeamMember: { Title: "Pennie Tamorada" } }] });
    if (url.includes("FieldValuesAsText")) return jsonResponse({ value: [{ ID: 7, FieldValuesAsText: { AssignedTeamMember: "" } }] });
    if (url.includes("/items?$orderby")) return jsonResponse({ value: [{ ID: 7, Status: "In transit" }] });
    if (url.endsWith("/_api/contextinfo")) return jsonResponse({ FormDigestValue: "digest-value" });
    if (url.endsWith("/items(7)") && options.method === "POST" && conflictOnWrite) return jsonResponse({ error: "etag conflict" }, 412);
    if (url.endsWith("/items(7)") && options.method === "POST") return jsonResponse({}, 204);
    if (url.includes("/items(7)?$select=") && failVerificationRead) return jsonResponse({ error: "temporary verification failure" }, 503);
    if (url.includes("/items(7)?$select=")) return jsonResponse({
      ID: 7,
      Modified: "2026-07-14T02:00:00Z",
      Status: "In transit",
      OriginShipper: "Hunan Kyson Co., Ltd.",
      ETA: "2026-07-13T14:00:00Z",
      VesselName: "EVER SUPERB 0115S",
      TelexHBL: true,
      "@odata.etag": "\"5\""
    });
    return jsonResponse({ error: "unexpected request" }, 404);
  }
});
vm.runInContext(contentSource, bridgeContext);
assert.equal(typeof messageListener, "function");

function sendBridgeMessage(message) {
  return new Promise((resolve) => messageListener(message, {}, resolve));
}

const loadedData = await sendBridgeMessage({ type: "TMA_GET_LIST_DATA" });
assert.equal(loadedData.ok, true);
assert.equal(loadedData.data.items[0].AssignedTeamMember.Title, "Pennie Tamorada");
assert.equal(TmaData.transformItems(loadedData.data.items, loadedData.data.fields, "2026-07-14T00:00:00+10:00").rows[0].assignedTeam, "Pennie Tamorada");

const updateResponse = await sendBridgeMessage({
  type: "TMA_UPDATE_LIST_ITEM",
  itemId: 7,
  etag: "\"4\"",
  updates: [
    { internalName: "Status", value: "In transit" },
    { internalName: "OriginShipper", value: "Hunan Kyson Co., Ltd." },
    { internalName: "ETA", value: "2026-07-14T00:00:00Z" },
    { internalName: "VesselName", value: "EVER SUPERB 0115S" },
    { internalName: "TelexHBL", value: true }
  ]
});
assert.equal(updateResponse.ok, true);
assert.equal(updateResponse.result.verified, true);
const mergeRequest = requests.find((request) => request.url.endsWith("/items(7)"));
assert.ok(mergeRequest, "expected a SharePoint MERGE request");
assert.equal(mergeRequest.options.headers["X-HTTP-Method"], "MERGE");
assert.equal(mergeRequest.options.headers["IF-MATCH"], "\"4\"");
assert.equal(mergeRequest.options.headers["X-RequestDigest"], "digest-value");
const mergePayload = JSON.parse(mergeRequest.options.body);
assert.equal(mergePayload.Status, "In transit");
assert.equal(mergePayload.OriginShipper, "Hunan Kyson Co., Ltd.");
assert.equal(mergePayload.VesselName, "EVER SUPERB 0115S");
assert.equal(mergePayload.Title, undefined);

const blockedResponse = await sendBridgeMessage({ type: "TMA_UPDATE_LIST_ITEM", itemId: 7, updates: [{ internalName: "Title", value: "Blocked" }] });
assert.equal(blockedResponse.ok, false);
assert.match(blockedResponse.error, /not approved/);

const requiredResponse = await sendBridgeMessage({ type: "TMA_UPDATE_LIST_ITEM", itemId: 7, updates: [{ internalName: "Status", value: "" }] });
assert.equal(requiredResponse.ok, false);
assert.match(requiredResponse.error, /required/);

const duplicateUpdateResponse = await sendBridgeMessage({
  type: "TMA_UPDATE_LIST_ITEM",
  itemId: 7,
  etag: "\"5\"",
  updates: [
    { internalName: "VesselName", value: "ONE" },
    { internalName: "VesselName", value: "TWO" }
  ]
});
assert.equal(duplicateUpdateResponse.ok, false);
assert.match(duplicateUpdateResponse.error, /more than once/);

failVerificationRead = true;
const acceptedUnverifiedResponse = await sendBridgeMessage({
  type: "TMA_UPDATE_LIST_ITEM",
  itemId: 7,
  etag: "\"5\"",
  updates: [{ internalName: "VesselName", value: "EVER SUPERB 0115S" }]
});
assert.equal(acceptedUnverifiedResponse.ok, true, "an accepted write must not be reported as failed only because the verification read failed");
assert.equal(acceptedUnverifiedResponse.result.updateAccepted, true);
assert.equal(acceptedUnverifiedResponse.result.verified, false);
assert.match(acceptedUnverifiedResponse.result.verificationError, /503/);

failVerificationRead = false;
const guardedFallbackEtagResponse = await sendBridgeMessage({
  type: "TMA_UPDATE_LIST_ITEM",
  itemId: 7,
  etag: "*",
  modified: "2026-07-14T02:00:00Z",
  updates: [{ internalName: "VesselName", value: "EVER SUPERB 0115S" }]
});
assert.equal(guardedFallbackEtagResponse.ok, true);
assert.equal(guardedFallbackEtagResponse.result.verified, true);
const mergeRequests = requests.filter((request) => request.url.endsWith("/items(7)") && request.options.method === "POST");
assert.equal(mergeRequests.at(-1).options.headers["IF-MATCH"], "\"5\"", "wildcard ETag must be replaced by the current SharePoint record version");

conflictOnWrite = true;
const conflictResponse = await sendBridgeMessage({
  type: "TMA_UPDATE_LIST_ITEM",
  itemId: 7,
  etag: "\"4\"",
  updates: [{ internalName: "VesselName", value: "DO NOT OVERWRITE" }]
});
assert.equal(conflictResponse.ok, false);
assert.match(conflictResponse.error, /changed in SharePoint/);

console.log("TMA Logistics Hub data tests passed");
