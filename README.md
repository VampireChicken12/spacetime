![Spacetime Logo](https://raw.githubusercontent.com/JoelBesada/spacetime/master/assets/Logo.png)

# Spacetime - Automatic Workspace Time Tracking

Spacetime is a VSCode extension that automatically tracks time spent in different workspaces (projects) and presents your daily activity in a nice, interactive chart.

![Spacetime Screenshot](https://raw.githubusercontent.com/JoelBesada/spacetime/master/assets/Screenshot.png)

## Features

- Set it and forget it, Spacetime is a fully automatic time tracker.
- Spacetime visualizes how much time you've put into each of your projects, on a daily, weekly, monthly and yearly basis.
- Come back and see exactly how much time you sunk into all those projects that you never ended up finishing.

## Commands

| Name                                            | Description                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| `Spacetime: View Stats`                         | Open up the stats panel for viewing time spent in each workspace. |
| `Spacetime: Reset All Stats`                    | Resets stats for all workspaces.                                  |
| `Spacetime: Reset Stats for Workspace`          | Resets stats for a specific workspace.                            |
| `Spacetime: Import Stats from CSV`              | Import stats from CSV file.                                       |
| `Spacetime: Import Stats from JSON`             | Import stats from JSON file.                                      |
| `Spacetime: Export Stats as JSON`               | Export stats to JSON file.                                        |
| `Spacetime: Export Stats as CSV`                | Export stats to CSV file.                                         |
| `Spacetime: Export Stats for Workspace as JSON` | Export stats for a specific workspace to JSON file.               |
| `Spacetime: Export Stats for Workspace as CSV`  | Export stats for a specific workspace to CSV file.                |

## Extension Settings

| Name                       | Description                                                                                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `spacetime.maxIdleMinutes` | Spacetime tracks work activity by looking at time elapsed between file save events within each workspace. This setting defines the maximum number of minutes that spacetime considers as active work time prior to a new save event occurring. |

## Release Notes

### 1.0.0

Initial release of Spacetime
