/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as path from "path";
import inlinedScript from "./inlinedScript";

const WORK_SPACE_TIMES_STORAGE_KEY = "workspaceTimes";
const MAX_IDLE_TIME_SECONDS = 60 * 15;

type WorkspaceEvent = {
	timestamp: number;
	type: "opened" | "saved" | "closed";
};
type WorkspaceTimes = {
	[workspaceName: string]: {
		[date: string]: number; // Time in seconds
	};
};

const workspaceEvents: {
	[workspaceName: string]: WorkspaceEvent[];
} = {};

export function activate(context: vscode.ExtensionContext) {
	context.globalState.setKeysForSync([WORK_SPACE_TIMES_STORAGE_KEY]);

	vscode.workspace.workspaceFolders?.forEach(({ name }) => {
		workspaceEvents[name] = [{ timestamp: Date.now(), type: "opened" }];
	});

	vscode.workspace.onDidSaveTextDocument((document) => {
		const maxIdleTimeSeconds = vscode.workspace.getConfiguration("spacetime").maxIdleMinutes * 60 || MAX_IDLE_TIME_SECONDS;
		if (document.uri.scheme === "file") {
			const savedWorkspace = vscode.workspace.getWorkspaceFolder(document.uri);
			if (savedWorkspace) {
				const { name } = savedWorkspace;
				workspaceEvents[name] = workspaceEvents[name] || [];
				const prevEvent = workspaceEvents[name][workspaceEvents[name].length - 1];
				workspaceEvents[name].push({ timestamp: Date.now(), type: "saved" });
				if (prevEvent) {
					const workTimeSeconds = Math.min(maxIdleTimeSeconds, (Date.now() - prevEvent.timestamp) / 1000);
					const workspaceTimes = context.globalState.get<WorkspaceTimes>(WORK_SPACE_TIMES_STORAGE_KEY, {});
					const date = new Date().toISOString().split("T")[0];
					workspaceTimes[name] = workspaceTimes[name] || {};
					workspaceTimes[name][date] = (workspaceTimes[name][date] || 0) + workTimeSeconds;

					context.globalState.update("workspaceTimes", workspaceTimes);
				}
			}
		}
	});

	let disposable = vscode.commands.registerCommand("spacetime.viewStats", () => {
		const panel = vscode.window.createWebviewPanel("spacetime-stats", "Spacetime Stats", vscode.ViewColumn.One, {
			enableScripts: true
		});
		const workspaceTimes = context.globalState.get<WorkspaceTimes>(WORK_SPACE_TIMES_STORAGE_KEY, {});
		const workspaceNames = Object.keys(workspaceTimes);
		const workspaceDates = Object.values(workspaceTimes).reduce((acc, curr) => {
			Object.keys(curr).forEach((date) => acc.add(date));
			return acc;
		}, new Set<string>());
		const minimumDate = new Date(Array.from(workspaceDates.values()).sort()[0]).toISOString().split("T")[0];
		const dayInMilliseconds = 1000 * 60 * 60 * 24;
		const today = new Date(Date.now()).toISOString().split("T")[0];
		const sevenDaysAgo = new Date(Date.now() - dayInMilliseconds * 7).toISOString().split("T")[0];

		const logoURI = panel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, "assets", "Logo.png")));

		function generateWorkspaceSelectHTML(workspaceNames: string[]): string {
			const longestWorkspaceName = workspaceNames.reduce((longest, current) => (current.length > longest.length ? current : longest), "");
			const optionsHTML = workspaceNames
				.map((workspaceName) => `<div class="option" onclick="toggleOption('${workspaceName}')" data-value="${workspaceName}">${workspaceName}</div>`)
				.join("");

			return `
			<div class="workspace-select" id="workspacesSelect">
					<div class="workspaces-select-trigger" onclick="toggleOptions()" style="min-width: ${longestWorkspaceName.length}ch;">Select Workspaces</div>
					<div class="workspaces-options-container" id="workspacesSelectOptionsContainer">
							<div class="option" onclick="toggleAllOptions()">Select All</div>
							<div class="option" onclick="unselectAllOptions()">Unselect All</div>
							${optionsHTML}
					</div>
			</div>
			`;
		}
		panel.webview.html = `<!DOCTYPE html>
		<html lang="en">
		<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Spacetime Stats</title>
				<style>
					h1 {
						font-size: 2.5em;
					}
					h2 {
						font-size: 1.75em;
					}

					input, select {
						background: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						outline: none;
						border: none;
						box-shadow: none;
						padding: 0.5em;
						cursor: pointer;
					}

					select {
						appearance: none;
						padding: 0.6em 0.5em;
						min-width: 100px;
					}

					.select-wrapper {
						display: inline-block;
						position: relative;
					}
					.select-wrapper:after {
						content: '';
						display: block;
						position: absolute;
						background: var(--vscode-input-foreground);
						width: 0.7em;
						height: 0.4em;
						top: 50%;
						right: 0.7em;
						margin-top: -0.2em;
						clip-path: polygon(100% 0%, 0 0%, 50% 100%);
					}

					input[type="date"]::-webkit-calendar-picker-indicator {
						filter: invert(1);
						cursor: pointer;
					}

					.vscode-light input, .vscode-light select {
						border: 1px solid #ccc;
					}

					.vscode-light input[type="date"]::-webkit-calendar-picker-indicator {
						filter: none;
					}

					.vscode-high-contrast input, .vscode-high-contrast select {
						border: 1px solid white;
					}

					.heading {
						display: flex;
						flex-wrap: wrap;
						justify-content: space-between;
						align-items: center;
						margin: 20px 0;
					}
					.date-inputs {
						height: 31px;
					}
					
					.date-inputs input {
            margin: 0 0.25em;
						height: 17.7px;
					}

					.input-container {
						padding: 1em 0.5em;
					}

					.heading h1 {
						margin: 0;
					}

					.header-wrapper {
						display: flex;
						align-items: center;
					}

					.header-wrapper img {
						width: 80px;
						height: 80px;
						margin-right: 1em;
					}

					.chart-section {
						max-width: 1200px;
						padding-bottom: 40px;
					}

					thead {
						background: rgba(100, 100, 100, 0.25);
						border-bottom: 1px solid rgba(100, 100, 100, 0.5);
					}
					tbody tr {
						background: rgba(100, 100, 100, 0.10);
					}
					tbody tr:nth-child(2n) {
						background: rgba(100, 100, 100, 0.25);
					}
					th, td {
							text-align: left;
							min-width: 200px;
							padding: 1em 1em;
					}
					th:not(:last-child), td:not(:last-child) {
						border-right: 1px solid rgba(100, 100, 100, 0.5);
					}

					.vscode-light thead {
						background: rgba(100, 100, 100, 0.1);
						border-bottom: 1px solid rgba(100, 100, 100, 0.25);
					}

					.vscode-light tbody tr {
						background: rgba(100, 100, 100, 0.03);
					}
					.vscode-light tbody tr:nth-child(2n) {
						background: rgba(100, 100, 100, 0.1);
					}
			
					.vscode-light th:not(:last-child), .vscode-light td:not(:last-child) {
						border-right: 1px solid rgba(100, 100, 100, 0.25);
					}

					table {
							border-collapse: collapse;
							font-size: 16px;
							width: 100%;
							max-width: 800px;
					}

					.workspace-color {
						display: inline-block;
						width: 14px;
						height: 14px;
						margin-right: 0.25em;
						vertical-align: middle;
					}

					.totals-section {
						padding-bottom: 100px;
					}

					.workspace-select {
						position: relative;
						display: inline-block;
					}
			
					.workspaces-select-trigger {
						background: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						outline: none;
						border: none;
						box-shadow: none;
						padding: 0.5em;
						cursor: pointer;
						display: flex;
						justify-content: space-between;
						align-items: center;
						height: 18px;
					}

					.workspaces-select-trigger:after {
						content: '';
						display: block;
						position: absolute;
						background: var(--vscode-input-foreground);
						width: 0.7em;
						height: 0.4em;
						top: 50%;
						right: 0.7em;
						margin-top: -0.2em;
						clip-path: polygon(100% 0%, 0 0%, 50% 100%);
					}
			
					.workspaces-options-container {
						position: absolute;
						top: 100%;
						left: 0;
						width: 100%;
						background: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						border: none;
						display: none;
						flex-direction: column;
						max-height: 150px;
						overflow-y: auto;
					}
			
					.workspaces-options-container .option {
						padding: 8px;
						cursor: pointer;
						transition: background-color 0.3s;
					}
					
					.workspaces-options-container .option.selected {
						background-color: rgba(0,0,0,0.75);
					}

					.workspaces-options-container .option:hover {
						background-color: rgba(0,0,0,0.5);
					}
				</style>
		</head>
		<body>
		  <div class="heading">
				<div class="header-wrapper">
					<img src="${logoURI}" />
					<h1>Spacetime Stats</h1>
				</div>	
				<div class="input-container">
					<div class="date-inputs">
						From
						<input type="date" id="start" name="start" value=${sevenDaysAgo} max=${today} min=${minimumDate}>
						to
						<input type="date" id="end" name="end" value=${today} max=${today} min=${minimumDate}>
						<div class="select-wrapper"><select id="group">
							<option value="daily" selected>Daily</option>
							<option value="weekly">Weekly</option>
							<option value="monthly">Monthly</option>
							<option value="yearly">Yearly</option>
						</select></div>
					</div>
				</div>
				<div class="input-container">
					<div class="sort-input">
						Sort by
						<div class="select-wrapper">
							<select id="sort-mode">
								<option value="alphabetical" selected>Alphabetical</option>
								<option value="time_spent">Time Spent</option>
							</select>
						</div>
						<div class="select-wrapper">
							<select id="sort-direction">
								<option value="asc" selected>Ascending</option>
								<option value="desc">Descending</option>
							</select>
						</div>
					</div>
		  	</div>
				<div class="input-container">
				${generateWorkspaceSelectHTML(workspaceNames)}
				</div>
			</div>
      <section class="chart-section">
				<canvas id="chart"></canvas>
			</section>
      <section class="totals-section">
				<h2>Totals</h2>
				<table>
				  <thead>
					  <tr>
						  <th>Workspace</th>
							<th>Time Spent</th>
						</tr>
					</thead>
					<tbody id="table-body">
					</tbody>
				</table>
			</section>

			<script src="https://cdn.jsdelivr.net/npm/chart.js@3.2.0/dist/chart.min.js"></script>
			<script>
				window.workspaceTimes = ${JSON.stringify(context.globalState.get(WORK_SPACE_TIMES_STORAGE_KEY, {}))}
			</script>
			<script>
				${inlinedScript.toString().split("\n").slice(1, -1).join("\n")}
			</script>
		</body>
		</html>`;
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(
		vscode.commands.registerCommand("spacetime.resetAllStats", () => {
			vscode.window.showWarningMessage("Are you sure you want to reset all stats?", "Yes").then((answer) => {
				if (answer === "Yes") {
					context.globalState.update(WORK_SPACE_TIMES_STORAGE_KEY, {});
					vscode.window.showInformationMessage("Successfully reset all stats");
				}
			});
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("spacetime.resetStatsForWorkspace", () => {
			vscode.window
				.showQuickPick(Object.keys(context.globalState.get(WORK_SPACE_TIMES_STORAGE_KEY, {})), {
					canPickMany: false,
					placeHolder: "Select a workspace to reset stats for"
				})
				.then((workspace) => {
					if (workspace) {
						vscode.window.showWarningMessage(`Are you sure you want to reset stats for ${workspace}?`, "Yes").then((answer) => {
							if (answer === "Yes") {
								const workspaceTimes = context.globalState.get<WorkspaceTimes>(WORK_SPACE_TIMES_STORAGE_KEY, {});
								delete workspaceTimes[workspace];
								context.globalState.update(WORK_SPACE_TIMES_STORAGE_KEY, workspaceTimes);
								vscode.window.showInformationMessage(`Successfully reset stats for ${workspace}`);
							}
						});
					}
				});
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("spacetime.exportStatsJson", () => {
			const workspaceTimes = context.globalState.get<WorkspaceTimes>(WORK_SPACE_TIMES_STORAGE_KEY, {});
			const workspaceTimesString = JSON.stringify(workspaceTimes, null, 2);
			vscode.window.showSaveDialog({ filters: { JSON: ["json"] }, defaultUri: vscode.Uri.file("stats.json") }).then((uri) => {
				if (uri) {
					vscode.workspace.fs.writeFile(uri, Buffer.from(workspaceTimesString)).then(() => {
						vscode.window.showInformationMessage(`Successfully exported all stats to ${uri.fsPath}`);
					});
				}
			});
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("spacetime.importStatsJson", () => {
			vscode.window.showOpenDialog({ filters: { JSON: ["json"] } }).then((uris) => {
				if (uris && uris.length) {
					vscode.workspace.fs.readFile(uris[0]).then((buffer) => {
						try {
							const workspaceTimes = context.globalState.get<WorkspaceTimes>(WORK_SPACE_TIMES_STORAGE_KEY, {});
							const workspaceTimesImport = JSON.parse(buffer.toString());
							context.globalState.update(WORK_SPACE_TIMES_STORAGE_KEY, Object.assign(workspaceTimes, workspaceTimesImport));
							vscode.window.showInformationMessage(`Stats imported from ${uris[0].fsPath}`);
						} catch (e) {
							vscode.window.showErrorMessage("Error parsing JSON file");
						}
					});
				}
			});
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("spacetime.exportStatsJsonForWorkspace", () => {
			const workspaceTimes = context.globalState.get<WorkspaceTimes>(WORK_SPACE_TIMES_STORAGE_KEY, {});
			vscode.window
				.showQuickPick(Object.keys(workspaceTimes), {
					canPickMany: false,
					placeHolder: "Select a workspace to export stats for"
				})
				.then((workspace) => {
					if (workspace) {
						const workspaceTimeString = JSON.stringify({ [workspace]: workspaceTimes[workspace] }, null, 2);
						vscode.window.showSaveDialog({ filters: { JSON: ["json"] }, defaultUri: vscode.Uri.file(`${workspace}.json`) }).then((uri) => {
							if (uri) {
								vscode.workspace.fs.writeFile(uri, Buffer.from(workspaceTimeString)).then(() => {
									vscode.window.showInformationMessage(`Successfully exported stats for ${workspace} to ${uri.fsPath}`);
								});
							}
						});
					}
				});
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("spacetime.exportStatsCsv", () => {
			const workspaceTimes = context.globalState.get<WorkspaceTimes>(WORK_SPACE_TIMES_STORAGE_KEY, {});
			const csv = Object.keys(workspaceTimes)
				.map((workspace) => {
					return Object.keys(workspaceTimes[workspace])
						.map((date) => {
							return `${workspace},${date},${workspaceTimes[workspace][date]}`;
						})
						.join("\n");
				})
				.join("\n");
			vscode.window.showSaveDialog({ filters: { CSV: ["csv"] }, defaultUri: vscode.Uri.file("stats.csv") }).then((uri) => {
				if (uri) {
					vscode.workspace.fs.writeFile(uri, Buffer.from(csv)).then(() => {
						vscode.window.showInformationMessage(`Successfully exported all stats to ${uri.fsPath}`);
					});
				}
			});
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("spacetime.importStatsCsv", () => {
			vscode.window.showOpenDialog({ filters: { CSV: ["csv"] } }).then((uris) => {
				if (uris && uris.length) {
					vscode.workspace.fs.readFile(uris[0]).then((buffer) => {
						try {
							const workspaceTimesImport = buffer
								.toString()
								.split("\n")
								.reduce<WorkspaceTimes>((acc, line) => {
									const [workspace, date, time] = line.split(",");
									if (workspace && date && time) {
										acc[workspace] = acc[workspace] || {};
										acc[workspace][date] = Number(time);
									}
									return acc;
								}, {});
							const workspaceTimes = context.globalState.get<WorkspaceTimes>(WORK_SPACE_TIMES_STORAGE_KEY, {});
							context.globalState.update(WORK_SPACE_TIMES_STORAGE_KEY, Object.assign(workspaceTimes, workspaceTimesImport));
							vscode.window.showInformationMessage(`Stats imported from ${uris[0].fsPath}`);
						} catch (e) {
							vscode.window.showErrorMessage("Error parsing CSV file");
						}
					});
				}
			});
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("spacetime.exportStatsCsvForWorkspace", () => {
			const workspaceTimes = context.globalState.get<WorkspaceTimes>(WORK_SPACE_TIMES_STORAGE_KEY, {});
			vscode.window
				.showQuickPick(Object.keys(workspaceTimes), {
					canPickMany: false,
					placeHolder: "Select a workspace to export stats for"
				})
				.then((workspace) => {
					if (workspace) {
						const csv = Object.keys(workspaceTimes[workspace])
							.map((date) => {
								return `${workspace},${date},${workspaceTimes[workspace][date]}`;
							})
							.join("\n");
						vscode.window.showSaveDialog({ filters: { CSV: ["csv"] }, defaultUri: vscode.Uri.file(`${workspace}.csv`) }).then((uri) => {
							if (uri) {
								vscode.workspace.fs.writeFile(uri, Buffer.from(csv)).then(() => {
									vscode.window.showInformationMessage(`Successfully exported stats for ${workspace} to ${uri.fsPath}`);
								});
							}
						});
					}
				});
		})
	);
}
