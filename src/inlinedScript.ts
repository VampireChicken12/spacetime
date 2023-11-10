type WorkspaceTimes = {
	[workspaceName: string]: {
		[date: string]: number; // Time in seconds
	};
};
type SortMode = "alphabetical" | "time_spent";
type SortDirection = "asc" | "desc";
type SortBy = `${SortMode}-${SortDirection}`;
type FilteredWorkspaceData = {
	workspaceName: string;
	totalTime: number;
	dates: { [date: string]: number };
};
// eslint-disable-next-line @typescript-eslint/naming-convention
export default (document: Document, window: Window, Chart: any) => {
	const CHART_COLORS = [
		"rgb(250, 211, 144)",
		"rgb(248, 194, 145)",
		"rgb(106, 137, 204)",
		"rgb(130, 204, 221)",
		"rgb(184, 233, 148)",
		"rgb(246, 185, 59)",
		"rgb(229, 80, 57)",
		"rgb(74, 105, 189)",
		"rgb(96, 163, 188)",
		"rgb(120, 224, 143)",
		"rgb(250, 152, 58)",
		"rgb(235, 47, 6)",
		"rgb(30, 55, 153)",
		"rgb(60, 99, 130)",
		"rgb(56, 173, 169)",
		"rgb(229, 142, 38)",
		"rgb(183, 21, 64)",
		"rgb(12, 36, 97)",
		"rgb(10, 61, 98)"
	];
	const formatTime = (_time: number) => {
		const time = Math.round(_time);
		const hours = Math.floor(time / 60 / 60);
		const minutes = Math.floor((time - hours * 60 * 60) / 60);
		const seconds = time % 60;
		const minutesString = `${minutes} minute${minutes > 1 ? "s" : ""}`;
		if (time < 60) {
			return "< 1 minute";
		}
		if (hours < 1) {
			return minutesString;
		}
		return `${hours} hour${hours > 1 ? "s" : ""}${minutes ? `, ${minutesString}` : ""}`;
	};
	let currentChart: any;
	function getSelectedWorkspacesData(workspaceTimes: WorkspaceTimes, selectedWorkspaces: string[]): WorkspaceTimes {
		const selectedWorkspacesData: WorkspaceTimes = {};

		selectedWorkspaces.forEach((workspaceName) => {
			if (workspaceTimes.hasOwnProperty(workspaceName)) {
				selectedWorkspacesData[workspaceName] = { ...workspaceTimes[workspaceName] };
			}
		});

		return selectedWorkspacesData;
	}
	function filterWorkspaceTimes(workspaceTimes: WorkspaceTimes, startDate: string, endDate: string): FilteredWorkspaceData[] {
		const filteredData: FilteredWorkspaceData[] = [];

		Object.entries(workspaceTimes).forEach(([workspaceName, dates]) => {
			const filteredDates = Object.entries(dates)
				.filter(([date]) => date >= startDate && date <= endDate)
				.reduce((acc, [date, time]) => {
					acc[date] = time;
					return acc;
				}, {} as { [date: string]: number });

			const totalTime = Object.values(filteredDates).reduce((acc, time) => acc + time, 0);

			if (totalTime > 0) {
				filteredData.push({
					workspaceName,
					totalTime,
					dates: filteredDates
				});
			}
		});

		return filteredData;
	}
	function sortFilteredTimes(filteredData: FilteredWorkspaceData[], sortBy: SortBy): FilteredWorkspaceData[] {
		const [sortMode, sortDirection] = sortBy.split("-") as [SortMode, SortDirection];

		return filteredData.sort((a, b) => {
			const compareValue = sortMode === "alphabetical" ? a.workspaceName.localeCompare(b.workspaceName) : b.totalTime - a.totalTime;

			return sortDirection === "asc" ? compareValue : -compareValue;
		});
	}
	type Group = "daily" | "weekly" | "monthly" | "yearly";

	const renderChart = (startDate: string, endDate: string, group: Group, sortBy: SortBy, workspaces: string[]) => {
		const startTimestamp = +new Date(startDate);
		const endTimestamp = +new Date(endDate);
		const sortedWorkspaceTimes = sortFilteredTimes(
			filterWorkspaceTimes(getSelectedWorkspacesData(window.workspaceTimes, workspaces), startDate, endDate),
			sortBy
		);
		console.log(sortedWorkspaceTimes);
		const timestamps: number[] = [];

		let currentTimestamp = startTimestamp;
		while (currentTimestamp <= endTimestamp) {
			timestamps.push(currentTimestamp);
			currentTimestamp += 1000 * 60 * 60 * 24;
		}

		const buckets = timestamps.reduce<Record<string, boolean>>((acc, time) => {
			const date = new Date(time).toISOString().split("T")[0];
			const [year, month, day] = date.split("-");
			const groupDate = (() => {
				if (group === "daily") {
					return [year, month, day].join("-");
				}
				if (group === "weekly") {
					// The week starts on a Monday and I will not be convinced otherwise
					const weekday = (new Date(time).getDay() + 6) % 7;
					return new Date(time - weekday * 1000 * 60 * 60 * 24).toISOString().split("T")[0];
				}
				if (group === "monthly") {
					return [year, month].join("-");
				}
				return year;
			})();
			acc[groupDate] = true;
			return acc;
		}, {});

		const data = {
			labels: Object.keys(buckets).map((bucket) => {
				const isCurrentYear = new Date(bucket).getFullYear() === new Date().getFullYear();
				return (
					(group === "weekly" ? "Week of " : "") +
					new Date(bucket).toLocaleString("en-US", {
						day: group === "daily" || group === "weekly" ? "numeric" : undefined,
						month: group === "yearly" ? undefined : "short",
						year: isCurrentYear && group !== "yearly" ? undefined : "numeric"
					})
				);
			}),
			datasets: sortedWorkspaceTimes.map(({ workspaceName: workspace, dates }, index) => {
				return {
					label: workspace,
					data: Object.keys(buckets).map((bucket) => {
						return timestamps
							.filter((timestamp) => {
								if (group === "weekly") {
									const weekday = (new Date(timestamp).getDay() + 6) % 7;
									return new Date(timestamp - weekday * 1000 * 60 * 60 * 24).toISOString().split("T")[0].indexOf(bucket) === 0;
								}
								return new Date(timestamp).toISOString().split("T")[0].indexOf(bucket) === 0;
							})
							.reduce((acc, timestamp) => {
								acc += dates[new Date(timestamp).toISOString().split("T")[0]] || 0;
								return acc;
							}, 0);
					}),
					backgroundColor: CHART_COLORS[(index * 2) % CHART_COLORS.length]
				};
			})
		};

		const config = {
			type: "bar",
			data,
			options: {
				responsive: true,
				scales: {
					x: {
						stacked: true
					},
					y: {
						stacked: true,
						ticks: {
							callback: (value: number) => {
								if (!value) {
									return null;
								}
								return formatTime(Math.floor(value / 60 / 60) * 60 * 60);
							}
						}
					}
				},
				plugins: {
					tooltip: {
						callbacks: {
							label: (tooltipItem: any) => {
								if (!tooltipItem.raw) {
									return null;
								}
								return `${tooltipItem.dataset.label}: ${formatTime(tooltipItem.raw)}`;
							}
						}
					}
				}
			}
		};

		if (currentChart) {
			currentChart.destroy();
		}

		currentChart = new Chart(document.getElementById("chart"), config);
	};
	const renderTable = (startDate: string, endDate: string, sortBy: SortBy, workspaces: string[]) => {
		const tbody = document.getElementById("table-body");
		if (!tbody) {
			return;
		}
		tbody.innerHTML = "";
		const sortedWorkspaceTimes = sortFilteredTimes(
			filterWorkspaceTimes(getSelectedWorkspacesData(window.workspaceTimes, workspaces), startDate, endDate),
			sortBy
		);
		console.log(sortedWorkspaceTimes);
		sortedWorkspaceTimes.forEach(({ workspaceName: workspace, totalTime }, index) => {
			const tr = document.createElement("tr");
			tr.innerHTML = `
        <td>
          <div class="workspace-color" style="background-color: ${CHART_COLORS[(index * 2) % CHART_COLORS.length]}"></div>
          ${workspace}
        </td>
        <td>${formatTime(totalTime)}</td>
      `;
			tbody.appendChild(tr);
		});
	};
	function toggleOptions() {
		const optionsContainer = document.getElementById("optionsContainer");
		if (!optionsContainer) {
			return;
		}
		optionsContainer.style.display = optionsContainer.style.display === "none" ? "flex" : "none";

		if (optionsContainer.style.display === "flex") {
			// Add a click event listener to the document to close the options container when clicked outside
			document.addEventListener("click", closeOptionsOnClickOutside);
		} else {
			// Remove the click event listener when the options container is hidden
			document.removeEventListener("click", closeOptionsOnClickOutside);
		}
	}

	function closeOptionsOnClickOutside(event: Event) {
		const optionsContainer = document.getElementById("optionsContainer");
		if (!optionsContainer) {
			return;
		}
		const customSelect = document.getElementById("customSelect");
		if (!customSelect) {
			return;
		}
		// Check if the click target is outside the custom select container and options container
		if (!customSelect.contains(event.target as Node) && !optionsContainer.contains(event.target as Node)) {
			optionsContainer.style.display = "none";
			document.removeEventListener("click", closeOptionsOnClickOutside);
		}
	}

	function toggleOption(value: string) {
		const optionsContainer = document.getElementById("optionsContainer");
		if (!optionsContainer) {
			return;
		}
		const selectedValues = getSelectedWorkspaces();

		if (selectedValues.includes(value)) {
			// Remove the value if it's already selected
			optionsContainer.querySelector(`[data-value="${value}"]`)?.classList.remove("selected");
		} else {
			// Add the value to the selected values
			optionsContainer.querySelector(`[data-value="${value}"]`)?.classList.add("selected");
		}

		updateSelectTriggerText();
		render();
	}

	function getSelectedWorkspaces() {
		const optionsContainer = document.getElementById("optionsContainer");
		if (!optionsContainer) {
			return [];
		}
		const selectedOptions: HTMLDivElement[] = Array.from(optionsContainer.querySelectorAll(".option.selected"));
		const selectedValues = selectedOptions.map((option) => option.dataset.value).filter(Boolean);
		return selectedValues as string[];
	}

	function updateSelectTriggerText() {
		const selectTrigger = document.querySelector(".select-trigger");
		if (!selectTrigger) {
			return;
		}
		const selectedValues = getSelectedWorkspaces();
		const summaryText = selectedValues.length > 3 ? `${selectedValues.length} selected` : selectedValues.join(", ");

		selectTrigger.textContent = selectedValues.length > 0 ? summaryText : "Select Workspaces";
	}
	function toggleAllOptions() {
		const options = document.querySelectorAll(".option");
		options.forEach((option) => option.classList.add("selected"));
		updateSelectTriggerText();
		render();
	}

	function unselectAllOptions() {
		const options = document.querySelectorAll(".option");
		options.forEach((option) => option.classList.remove("selected"));
		updateSelectTriggerText();
		render();
	}
	const today = new Date(Date.now()).toISOString().split("T")[0];
	const startInput = document.getElementById("start") as HTMLInputElement | null;
	const endInput = document.getElementById("end") as HTMLInputElement | null;
	const groupInput = document.getElementById("group") as HTMLSelectElement | null;
	const sortModeInput = document.getElementById("sort-mode") as HTMLSelectElement | null;
	const sortDirectionInput = document.getElementById("sort-direction") as HTMLSelectElement | null;
	toggleAllOptions();
	function render() {
		const startDate = startInput?.value ?? today;
		const endDate = endInput?.value ?? today;
		const group = (groupInput?.value ?? "daily") as Group;
		const sortMode = sortModeInput?.value ?? "alphabetical";
		const sortDirection = sortDirectionInput?.value ?? "asc";
		const selectedWorkspaces = getSelectedWorkspaces();
		if (!["asc", "desc"].includes(sortDirection)) {
			throw new Error("Invalid sort direction: " + sortDirection);
		}
		if (!["alphabetical", "time_spent"].includes(sortMode)) {
			throw new Error("Invalid sort mode: " + sortMode);
		}
		const sortBy = `${sortMode}-${sortDirection}` as SortBy;
		renderChart(startDate, endDate, group, sortBy, selectedWorkspaces);
		renderTable(startDate, endDate, sortBy, selectedWorkspaces);
	}

	startInput?.addEventListener("change", render);
	endInput?.addEventListener("change", render);
	groupInput?.addEventListener("change", render);
	sortModeInput?.addEventListener("change", render);
	sortDirectionInput?.addEventListener("change", render);
	render();
};
