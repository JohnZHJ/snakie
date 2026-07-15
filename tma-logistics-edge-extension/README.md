# TMA Logistics Hub for Microsoft Edge

Manager-focused logistics risk control tower and verified editor for the **TMA Freight Request Form** SharePoint List.

## What is new in 1.6.1

- Fixes the dashboard freezing on "Reading SharePoint List" after the extension is updated or reloaded: the List-tab bridge now detects that it belongs to an unloaded extension copy and hands over to the fresh one, so the SharePoint tab no longer needs a manual refresh after every upgrade.
- Adds a two-minute timeout to the List read so the dashboard always shows an actionable message instead of loading forever.
- Explains connection failures in plain language: a dashboard tab left over from before an upgrade now says to close it and reopen from the toolbar icon, and an unresponsive List tab now says to refresh that tab.

## What is new in 1.6.0

- Wakes the SharePoint List tab automatically when Edge has put it to sleep, so scheduled refreshes and confirmed edits no longer fail after the tab has been idle (Edge "sleeping tabs").
- Re-finds the SharePoint List tab when the remembered tab was closed and another matching tab is open, instead of failing with a tab error.
- Refreshes automatically as soon as you return to the dashboard if the data is more than five minutes old, instead of waiting for the next timer tick.
- Adds proper toolbar and store icons so the extension no longer shows the generic Edge placeholder.
- Debounces the search box so typing stays smooth on large lists.
- Neutralises leading `=`, `+`, `@` and `-` characters in CSV exports so Excel treats every exported cell as text, never as a formula.
- Shows the header date in the Australia/Sydney calendar, matching every other date on the dashboard.

## What version 1.5.0 does

### Reliability guardrails

- Prefers exact SharePoint title aliases; permits only a single unambiguous contained-title fallback, labels that mapping for review, and blocks ambiguous matches.
- Suppresses any risk or missing-field rule whose source column is unavailable, preventing a schema problem from becoming hundreds of false shipment alerts.
- Reads raw SharePoint schedule timestamps first and resolves them to the Australia/Sydney calendar date, avoiding both DD/MM ambiguity and UTC day-shift errors.
- Separates invalid, ambiguous and contradictory schedule dates into a dedicated **Data checks** view instead of presenting them as confirmed operational risk.
- Excludes invalid IDs and duplicate rows before calculating metrics, and reports every exclusion in the Data Assurance bar.
- Uses request ordering so a slower old refresh cannot overwrite a newer result.
- Auto-refreshes every five minutes while visible and marks the dashboard stale after ten minutes.
- Keeps the last verified snapshot visible when a later refresh fails instead of replacing the whole dashboard with an error screen.
- Uses SharePoint's exact record version for writeback, stops on concurrent changes, validates Text and Choice values, and verifies every changed field after SharePoint accepts the update.
- Blocks impossible schedule edits when Cargo Ready is after effective ETD or ETA is before effective ETD.

### Control-tower functions

- Reads the List through your already signed-in TMA SharePoint tab.
- Shows the Origin Shipper Name beside each route.
- Detects several risk signals per shipment instead of showing only the first issue.
- Forecasts ETA overdue or missing, HBL release risk, departure readiness, FOB ETD overdue, cargo-ready booking risk, ETD slippage and near arrivals.
- Adds practical Work Views for every risk signal, active shipments, arrivals and missing information.
- Makes all four KPI cards clickable filters.
- Shows the Assigned IMPEX Team member as the operational owner.
- Prioritises the live `Assigned IMPEX Team Member` column over older similarly named fields and falls back across aliases when one column is blank.
- Reads SharePoint Person fields through an explicit User expansion so owner names are available to Risk by owner and owner filters.
- Keeps responsibility assignment out of Missing Fields; unassigned risk belongs in Risk by owner rather than shipment data completeness.
- Adds an owner filter, owner workload sorting and a clickable Risk by owner view.
- Adds Priority, Owner, ETA, newest ID and Status sorting.
- Detects important operational data gaps based on shipment stage.
- Shows the missing field names directly on each shipment and expands more names in the Missing Fields view.
- Sorts Missing Fields by the number of gaps so the least complete records appear first.
- Generates a shipment summary that can be copied directly into Teams or email.
- Generates a ready-to-send follow-up message addressed to the Assigned IMPEX Team member with risk and required action.
- Generates a Risk Handoff grouped by owner for delegation through Teams or email.
- Filters by Status, Inbound/Outbound and urgency.
- Opens an edit drawer for selected operational fields.
- Shows old and new values before any update.
- Writes only confirmed changes directly to the SharePoint List, then reads the record back to verify the saved values.
- Normalises spaces, slashes, punctuation and capitalisation in SharePoint column names, so ordinary Text fields such as `Vessel / Flight Name` remain editable.
- Shows the exact reason under Vessel / Flight Name if SharePoint itself reports the column as read-only or unsupported.
- Opens the original SharePoint record when you select an ID.
- Opens the original SharePoint form for new requests.
- Exports the currently filtered rows to a local CSV file.

The extension does not contain a Microsoft password, cookie or access token. It does not send List data to an external API. It uses the permissions of your signed-in TMA account and only writes after the final confirmation button is selected.

## Risk signal rules

- **Critical:** Status is `In transit` and Vessel/Flight ETA is earlier than today.
- **High:** Status is `In transit` but ETA is missing.
- **High:** An inbound sea shipment is due within five days and Telex-released HBL is not confirmed.
- **High:** A pre-departure shipment is within three days of ETD but the booking or vessel/flight is missing.
- **High:** A pre-departure record has Incoterms containing `FOB`, Vessel/Flight ETD earlier than today, and revised ETD earlier than today. Pre-departure covers New Request, quote stages, Booking Sent to Agent, and Booking complete.
- **High:** Status is `New Request`, `Quote In Progress`, or `Quote Complete`, and Cargo Ready Date is today or earlier.
- **Watch:** Revised ETD is at least three days later than the original ETD.
- **Watch:** An active shipment is due to arrive within two days.

The Risk Alerts KPI counts Critical and High records. A shipment can carry more than one signal. Arriving This Week uses active shipments with ETA within seven days.

## Install

1. Extract `TMA-Logistics-Hub-Edge-v1.6.1.zip` into a permanent folder, for example `Documents\TMA-Logistics-Hub`.
2. In Microsoft Edge, open `edge://extensions`.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Select the extracted folder that directly contains `manifest.json`.
6. Pin **TMA Logistics Hub** from the Edge Extensions menu if desired.

## Upgrade

Copy the new extension files over the existing extension folder, then select **Reload** on `edge://extensions`.

## First connection

1. Open the TMA Freight Request Form SharePoint List and confirm you are signed in.
2. Refresh that SharePoint tab once after installing the extension.
3. Select the TMA Logistics Hub extension icon.
4. The dashboard opens in a separate tab and reads the List.

Keep the SharePoint List tab open while using the dashboard. It refreshes every five minutes while visible; the refresh button remains available for an immediate read.

## First update test

1. Choose a record that is safe to test.
2. Select **Edit** and change one low-risk field, such as Origin Shipper Name.
3. Select **Review changes**.
4. Check the old and new values carefully.
5. Select **Confirm update**.
6. Open or refresh the same record in SharePoint and confirm the value changed.

If a field is unavailable in the editor, the extension detected that SharePoint marks it as read-only or uses a field type that this version intentionally does not write.

## Troubleshooting

### Dashboard says “SharePoint connection needed”

Open this List, sign in, refresh the List tab, then select **Try again** in the dashboard:

`https://tmaaust-my.sharepoint.com/personal/sharepoint_admin_tmagroup_com_au/Lists/TMA%20Freight%20Request%20Form/AllItems.aspx`

### Access denied or sign-in page returned

Confirm that the same Edge profile has access to the List. The extension can only use permissions already granted to your TMA account.

### A field says “Not detected”

Open **Detected SharePoint fields** in the dashboard. The first version automatically maps the visible column names from the supplied screenshots. SharePoint internal names may differ, so an unmapped field can be added after the first live test.

### Edge removes the extension after the folder is moved

Extract the ZIP into a permanent folder before using **Load unpacked**. Do not delete or move that folder while the extension is installed.

## Removal

Open `edge://extensions`, find **TMA Logistics Hub**, and select **Remove**. Delete the extracted folder afterward if desired.
