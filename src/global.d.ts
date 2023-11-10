declare global {
	interface Window {
		workspaceTimes: {
			[workspaceName: string]: {
				[date: string]: number;
			};
		};
	}
}
export {};
