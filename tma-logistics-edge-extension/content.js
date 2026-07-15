(() => {
  // A bridge left behind by an older, unloaded copy of the extension cannot
  // answer messages any more, so only keep it when its runtime is still alive.
  try {
    if (globalThis.__TMA_LOGISTICS_SHAREPOINT_BRIDGE__?.alive?.() === true) return;
  } catch {
    // The previous bridge belongs to an unloaded extension; replace it.
  }
  globalThis.__TMA_LOGISTICS_SHAREPOINT_BRIDGE__ = {
    alive: () => {
      try {
        return Boolean(chrome.runtime?.id);
      } catch {
        return false;
      }
    }
  };

  const SITE_PATH = "/personal/sharepoint_admin_tmagroup_com_au";
  const LIST_TITLE = "TMA Freight Request Form";
  const LIST_PATH_FRAGMENT = "/lists/tma freight request form/";
  const WRITABLE_TITLE_KEYS = new Set([
    "status",
    "cargoreadydate",
    "vesselflightetd",
    "revisedetd",
    "vesselflighteta",
    "telexreleasedhbl",
    "portoforigin",
    "portofdischarge",
    "originshippername",
    "container",
    "containernumber",
    "vesselflightname",
    "bookingnumberso",
    "bookingnumber"
  ]);
  const SUPPORTED_WRITE_TYPES = new Set(["text", "note", "choice", "datetime", "boolean"]);
  const ASSIGNED_TEAM_TITLE_KEYS = new Set(["assignedimpexteammember", "assignedimpexteam"]);
  const bridgeState = {
    allowedWritableFields: new Map(),
    listItemEntityType: "",
    listApi: "",
    siteUrl: ""
  };

  function isTargetListPage() {
    try {
      return decodeURIComponent(location.pathname)
        .toLowerCase()
        .includes(LIST_PATH_FRAGMENT);
    } catch {
      return location.pathname.toLowerCase().includes("/lists/tma%20freight%20request%20form/");
    }
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json;odata=nometadata"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SharePoint returned ${response.status}: ${text.slice(0, 180)}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      throw new Error("SharePoint returned a sign-in page. Refresh the List tab and confirm that you are signed in.");
    }

    return response.json();
  }

  function fieldProperty(field, names) {
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(field || {}, name)) return field[name];
    }
    const wanted = names.map((name) => name.toLowerCase());
    const key = Object.keys(field || {}).find((candidate) => wanted.includes(candidate.toLowerCase()));
    return key ? field[key] : undefined;
  }

  function normalizeTitle(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function configureWritableFields(fields, choicesByInternalName = new Map()) {
    bridgeState.allowedWritableFields.clear();
    for (const field of fields || []) {
      const displayTitle = String(fieldProperty(field, ["Title", "title"]) || "").trim();
      const titleKey = normalizeTitle(displayTitle);
      const internalName = fieldProperty(field, ["InternalName", "internalName", "StaticName", "staticName"]);
      const hidden = fieldProperty(field, ["Hidden", "hidden"]);
      const readOnly = fieldProperty(field, ["ReadOnlyField", "readOnlyField"]);
      const type = fieldProperty(field, ["TypeAsString", "typeAsString"]) || "Text";
      const required = fieldProperty(field, ["Required", "required"]) === true;
      if (!internalName || hidden === true || hidden === "true" || readOnly === true || readOnly === "true") continue;
      if (!WRITABLE_TITLE_KEYS.has(titleKey)) continue;
      if (!SUPPORTED_WRITE_TYPES.has(String(type).toLowerCase())) continue;
      bridgeState.allowedWritableFields.set(internalName, {
        title: displayTitle,
        titleKey,
        type,
        required,
        choices: choicesByInternalName.get(internalName) || []
      });
    }
  }

  function validatedUpdateValue(definition, value) {
    const type = String(definition.type || "").toLowerCase();
    if (definition.required && (value === null || value === undefined || value === "")) {
      throw new Error(`${definition.title} is required in SharePoint and cannot be blank.`);
    }
    if (type === "boolean") {
      if (typeof value !== "boolean") throw new Error(`${definition.title} must be Yes or No.`);
      return value;
    }
    if (type === "datetime") {
      if (value === null || value === "") return null;
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${definition.title} is not a valid date.`);
      return value;
    }
    if (!["text", "note", "choice"].includes(type) || typeof value !== "string") {
      throw new Error(`${definition.title} has an unsupported SharePoint value type.`);
    }
    const cleaned = value.trim();
    if (type === "text" && cleaned.length > 255) throw new Error(`${definition.title} is longer than SharePoint Text allows (255 characters).`);
    if (type === "choice" && definition.choices?.length && cleaned && !definition.choices.includes(cleaned)) {
      throw new Error(`${definition.title} must use one of the configured SharePoint choices.`);
    }
    return cleaned;
  }

  function itemEtag(item) {
    return item?.["@odata.etag"] || item?.["odata.etag"] || item?.__metadata?.etag || "";
  }

  function comparableValue(definition, value) {
    const type = String(definition.type || "").toLowerCase();
    if (type === "boolean") return Boolean(value);
    if (type === "datetime") {
      if (!value) return "";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return String(value);
      const parts = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Australia/Sydney"
      }).formatToParts(parsed);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${values.year}-${values.month}-${values.day}`;
    }
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  async function readCurrentItem(itemId, internalNames = []) {
    const safeNames = [...new Set(internalNames)].filter((name) => bridgeState.allowedWritableFields.has(name));
    const select = ["ID", "Modified", ...safeNames].join(",");
    return fetchJson(`${bridgeState.listApi}/items(${itemId})?$select=${encodeURIComponent(select).replace(/%2C/gi, ",")}`);
  }

  async function getRequestDigest(siteUrl) {
    const response = await fetch(`${siteUrl}/_api/contextinfo`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json;odata=nometadata",
        "Content-Type": "application/json;odata=nometadata"
      },
      body: ""
    });
    if (!response.ok) throw new Error(`Unable to obtain SharePoint request digest (${response.status}).`);
    const payload = await response.json();
    return payload.FormDigestValue || payload.d?.GetContextWebInformation?.FormDigestValue || payload.GetContextWebInformation?.FormDigestValue;
  }

  async function updateSharePointItem(message) {
    if (!isTargetListPage()) throw new Error("Keep the TMA Freight Request Form List open while saving.");
    const itemId = Number(message.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) throw new Error("Invalid SharePoint item ID.");
    if (!Array.isArray(message.updates) || !message.updates.length) throw new Error("No changes were supplied.");
    if (!bridgeState.listApi || !bridgeState.listItemEntityType) await loadSharePointData();

    const payload = {
      __metadata: { type: bridgeState.listItemEntityType }
    };
    const updateNames = new Set();
    for (const update of message.updates) {
      if (updateNames.has(update.internalName)) throw new Error(`Field ${update.internalName} was supplied more than once.`);
      updateNames.add(update.internalName);
      const definition = bridgeState.allowedWritableFields.get(update.internalName);
      if (!definition) throw new Error(`Field ${update.internalName} is not approved for dashboard editing.`);
      payload[update.internalName] = validatedUpdateValue(definition, update.value);
    }

    let ifMatch = String(message.etag || "").trim();
    if (!ifMatch || ifMatch === "*") {
      const current = await readCurrentItem(itemId);
      const currentModified = String(current.Modified || "");
      const loadedModified = String(message.modified || "");
      if (loadedModified && currentModified && Date.parse(loadedModified) !== Date.parse(currentModified)) {
        throw new Error("This record changed in SharePoint after the dashboard loaded. Refresh and review it again before saving.");
      }
      ifMatch = itemEtag(current);
      if (!ifMatch) throw new Error("SharePoint did not provide a record version, so the update was stopped to avoid overwriting a newer change.");
    }

    const digest = await getRequestDigest(bridgeState.siteUrl);
    if (!digest) throw new Error("SharePoint did not return a request digest.");
    const response = await fetch(`${bridgeState.listApi}/items(${itemId})`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json;odata=verbose",
        "Content-Type": "application/json;odata=verbose",
        "X-RequestDigest": digest,
        "IF-MATCH": ifMatch,
        "X-HTTP-Method": "MERGE"
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 412) {
      throw new Error("This record changed in SharePoint after the dashboard loaded. Refresh and review it again before saving.");
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SharePoint update failed (${response.status}): ${text.slice(0, 220)}`);
    }
    let verifiedItem = null;
    let verificationError = "";
    const mismatches = [];
    try {
      verifiedItem = await readCurrentItem(itemId, [...updateNames]);
      for (const internalName of updateNames) {
        const definition = bridgeState.allowedWritableFields.get(internalName);
        if (comparableValue(definition, verifiedItem[internalName]) !== comparableValue(definition, payload[internalName])) mismatches.push(definition.title);
      }
    } catch (error) {
      verificationError = error.message || "SharePoint verification read failed.";
      for (const internalName of updateNames) mismatches.push(bridgeState.allowedWritableFields.get(internalName).title);
    }
    return {
      itemId,
      updatedFields: [...updateNames],
      updateAccepted: true,
      verified: !verificationError && mismatches.length === 0,
      verificationMismatches: mismatches,
      verificationError,
      etag: itemEtag(verifiedItem),
      modified: verifiedItem?.Modified || ""
    };
  }

  async function fetchAllItems(initialUrl) {
    const items = [];
    let nextUrl = initialUrl;
    let pageCount = 0;
    const seenUrls = new Set();

    while (nextUrl && pageCount < 100) {
      if (seenUrls.has(nextUrl)) throw new Error("SharePoint pagination repeated the same page; loading stopped to avoid duplicate records.");
      seenUrls.add(nextUrl);
      const payload = await fetchJson(nextUrl);
      items.push(...(payload.value || payload.d?.results || []));
      nextUrl = payload["@odata.nextLink"] || payload["odata.nextLink"] || payload.d?.__next || null;
      pageCount += 1;
    }

    if (nextUrl) throw new Error("SharePoint returned more than 100 pages. Loading stopped rather than showing a partial dashboard.");

    return items;
  }

  async function loadSharePointData() {
    if (!isTargetListPage()) {
      throw new Error("Open the TMA Freight Request Form List in this SharePoint tab first.");
    }

    const siteUrl = `${location.origin}${SITE_PATH}`;
    const listApi = `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(LIST_TITLE)}')`;
    const fieldsUrl = `${listApi}/fields?$select=Title,InternalName,StaticName,TypeAsString,Hidden,ReadOnlyField,Required&$filter=Hidden%20eq%20false&$top=500`;
    const listInfoUrl = `${listApi}?$select=ListItemEntityTypeFullName`;
    const rawItemsUrl = `${listApi}/items?$orderby=ID%20desc&$top=5000`;
    const textItemsUrl = `${listApi}/items?$select=ID,FieldValuesAsText&$expand=FieldValuesAsText&$orderby=ID%20desc&$top=5000`;

    const [fieldsPayload, listInfo] = await Promise.all([
      fetchJson(fieldsUrl),
      fetchJson(listInfoUrl)
    ]);

    const fields = fieldsPayload.value || fieldsPayload.d?.results || [];
    const assignedPersonFields = fields.filter((field) => {
      const titleKey = normalizeTitle(fieldProperty(field, ["Title", "title"]));
      const type = String(fieldProperty(field, ["TypeAsString", "typeAsString"]) || "").toLowerCase();
      return ASSIGNED_TEAM_TITLE_KEYS.has(titleKey) && ["user", "usermulti"].includes(type);
    });
    const personRequests = assignedPersonFields.map((field) => {
      const internalName = fieldProperty(field, ["InternalName", "internalName", "StaticName", "staticName"]);
      if (!internalName) return Promise.resolve({ items: [], failed: true });
      const url = `${listApi}/items?$select=ID,${internalName}/Title&$expand=${internalName}&$orderby=ID%20desc&$top=5000`;
      return fetchAllItems(url).then((items) => ({ items, failed: false })).catch(() => ({ items: [], failed: true }));
    });
    const choiceFields = fields.filter((field) => {
      const titleKey = normalizeTitle(fieldProperty(field, ["Title", "title"]));
      const type = String(fieldProperty(field, ["TypeAsString", "typeAsString"]) || "").toLowerCase();
      return WRITABLE_TITLE_KEYS.has(titleKey) && type === "choice";
    });
    const choiceRequests = choiceFields.map((field) => {
      const internalName = fieldProperty(field, ["InternalName", "internalName", "StaticName", "staticName"]);
      const fieldUrl = `${listApi}/fields/getbyinternalnameortitle('${encodeURIComponent(internalName)}')?$select=Choices`;
      return fetchJson(fieldUrl)
        .then((payload) => ({ internalName, choices: payload.Choices?.results || payload.Choices || payload.d?.Choices?.results || [] }))
        .catch(() => ({ internalName, choices: [] }));
    });
    const [rawItems, textResult, personResults, choiceResults] = await Promise.all([
      fetchAllItems(rawItemsUrl),
      fetchAllItems(textItemsUrl).then((items) => ({ items, failed: false })).catch(() => ({ items: [], failed: true })),
      Promise.all(personRequests),
      Promise.all(choiceRequests)
    ]);
    const textItems = textResult.items;

    bridgeState.siteUrl = siteUrl;
    bridgeState.listApi = listApi;
    bridgeState.listItemEntityType = listInfo.ListItemEntityTypeFullName || listInfo.d?.ListItemEntityTypeFullName || "";
    const choicesByInternalName = new Map(choiceResults.map((result) => [result.internalName, result.choices]));
    configureWritableFields(fields, choicesByInternalName);

    const textById = new Map(textItems.map((item) => [Number(item.ID || item.Id), item.FieldValuesAsText || item.fieldValuesAsText || {}]));
    const personMaps = personResults.map((result) => new Map(result.items.map((item) => [Number(item.ID || item.Id), item])));
    const items = rawItems.map((item) => {
      const id = Number(item.ID || item.Id);
      const personValues = {};
      assignedPersonFields.forEach((field, index) => {
        const internalName = fieldProperty(field, ["InternalName", "internalName", "StaticName", "staticName"]);
        const expandedItem = personMaps[index]?.get(id);
        if (internalName && expandedItem && expandedItem[internalName] !== undefined) personValues[internalName] = expandedItem[internalName];
      });
      return {
        ...item,
        ...personValues,
        FieldValuesAsText: textById.get(id) || item.FieldValuesAsText || item.fieldValuesAsText || {}
      };
    });

    return {
      source: "TMA SharePoint",
      siteUrl,
      listUrl: location.href,
      listTitle: LIST_TITLE,
      fetchedAt: new Date().toISOString(),
      fields,
      writableFields: [...bridgeState.allowedWritableFields.entries()].map(([internalName, definition]) => ({ internalName, ...definition })),
      sourceDiagnostics: {
        rawItemCount: rawItems.length,
        formattedItemCount: textItems.length,
        formattedValuesAvailable: !textResult.failed,
        personFieldCount: assignedPersonFields.length,
        personReadFailures: personResults.filter((result) => result.failed).length
      },
      items
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "TMA_PING") {
      sendResponse({ ok: true, targetPage: isTargetListPage() });
      return false;
    }

    if (message?.type === "TMA_GET_LIST_DATA") {
      loadSharePointData()
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message?.type === "TMA_UPDATE_LIST_ITEM") {
      updateSharePointItem(message)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    return false;
  });
})();
