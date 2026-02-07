# Trip Screen Design Plan (v3)

> **Status**: Design Phase
> **Last Updated**: February 6, 2026
> **Description**: Core screen of the TripTracker app — the trip detail/status view that a truck driver uses while on a trip.

---

## Design Philosophy

The entire app follows a **clinical, compact, data-dense** styling approach. Think FanDuel or Bloomberg Mobile — not children's crayons.

### Global Style Rules

- **Font sizes**: 11-15px range. No large hero text. Labels are 11px uppercase, body is 13px, section titles max 14-15px.
- **Spacing**: Tight. Form groups 12px apart, content padding 14px, gaps 8-10px.
- **Border radius**: 6px (small, sharp). No bubbly 12-16px radii.
- **Colors**: Neutral grays (#6b7280, #374151, #1e293b). Subtle borders (#e5e7eb). Minimal color — only for status/type indicators.
- **Weight**: 500-600 font weight. No "900" black weight anywhere.
- **Icons**: 15-18px. Small and functional, not decorative.
- **Inputs**: 8px vertical padding, 10px horizontal. Compact.
- **Buttons**: 10px vertical padding. No oversized CTAs.

---

## Overview

The trip screen is a vertical, scrollable timeline showing all stops in a trip from start to finish. It is the primary screen a driver interacts with while on the road. Design priorities:

- **Minimal and glanceable** — compact text, clear hierarchy, data-dense
- **Visual progression** — completed, current, and upcoming stops are visually distinct
- **Easy interaction** — appropriately sized touch targets, no wasted space

---

## Stop Types

| Type             | Label on Card  | Color  | Description                              |
|------------------|----------------|--------|------------------------------------------|
| Empty Start      | "Empty Start"  | Blue   | Starting the trip empty, heading to first pickup |
| Pickup           | "Pickup"       | Green  | Loading cargo at a shipper location      |
| Stop             | "Stop"         | Orange | Generic intermediate stop (fuel, rest)   |
| Terminal         | "Terminal"      | Purple | Company terminal (trailer swap, check-in)|
| Delivery         | "Delivery"     | Red    | Unloading cargo at a consignee location  |
| Empty Reposition | "Reposition"   | Blue   | Repositioning empty after final delivery |

---

## Card Design (Minimal)

Each stop is represented as a card on the timeline. The design is intentionally minimal:

```
┌─────────────────────────────────────┐
│  Pickup                      [ ✓ ]  │  ← Type label (full word, bold) + completion checkbox (top-right, consistent position)
│  ABC Manufacturing                  │  ← Company / location name
│  📅 Feb 6, 2026                     │  ← Expected date (turns RED if past due)
└─────────────────────────────────────┘
```

### Card Fields

| Element              | Position    | Description                                                |
|----------------------|-------------|------------------------------------------------------------|
| **Type label**       | Top-left    | Full word (e.g., "Pickup", "Delivery"), bold, in the stop's type color |
| **Completion checkbox** | Top-right | Always in the same spot — tap to complete                  |
| **Company name**     | Below type  | Medium weight text                                         |
| **Expected date**    | Bottom      | Calendar icon + date. Turns **RED** if past due and not completed |

### What is NOT on the card (lives in drill-down only)

- Full address
- Actual date/time
- Odometer reading
- Notes

---

## Visual Progression

As the driver moves through the trip, there is a clear visual gradient from top to bottom:

```
  ██ Completed  — green-tinted background, muted text, green checkmark, solid green timeline connector
  ██ Completed  — green-tinted background, muted text, green checkmark, solid green timeline connector
  ▓▓ CURRENT   — full opacity, elevated with shadow, highlighted left border in stop's type color, larger/glowing timeline dot
  ░░ Upcoming  — light gray background, lighter text, empty circle checkbox, dashed gray timeline connector
  ░░ Upcoming  — light gray background, lighter text, empty circle checkbox, dashed gray timeline connector
```

### Status Indicator (Checkbox)

| State       | Visual                                      |
|-------------|---------------------------------------------|
| Not started | Empty gray circle                           |
| Current     | Highlighted/pulsing circle in stop's color  |
| Completed   | Filled green circle with white checkmark    |

---

## Mileage Between Stops

Between each pair of stop cards, the timeline connector displays the **mileage between those two stops**:

```
┌─────────────────────────────────────┐
│  Pickup                      [ ✓ ]  │
│  ABC Manufacturing                  │
│  📅 Feb 5, 2026                     │
└─────────────────────────────────────┘
              ↕ 142 mi                    ← Mileage between stops on the connector
┌─────────────────────────────────────┐
│  Terminal                    [ ○ ]  │
│  Stock Corporation                  │
│  📅 Feb 6, 2026                     │
└─────────────────────────────────────┘
```

- Mileage can be estimated (via mapping API) or manually entered
- Updates dynamically if stops are reordered

---

## Reordering Stops

Two methods available:

### 1. Up/Down Arrow Buttons (Primary — Recommended)

- Each card has small **up/down arrow** buttons on the right side
- Tap to move a stop up or down one position
- Precise, works with gloves, no fine motor control needed (ideal for truck cab)

### 2. Long-Press Drag (Secondary)

- Long-press a card to pick it up
- Drag to new position; other cards animate to make room
- Haptic feedback on grab and drop

### Constraints

- **Empty Start** is locked to the first position
- **Empty Reposition** is locked to the last position

---

## Adding Stops

Two ways to add a new stop:

1. **Inline "+" button** — appears on the timeline connector between any two stops. Tap to insert a new stop at that position.
2. **"Add Stop" button** — at the bottom of the timeline (above the summary). Adds a stop to the end.

When adding a stop:
- Defaults to generic "Stop" type
- Driver selects the correct type from a picker
- Then fills in company name, expected date, etc.

---

## Drill-Down Detail View

Tapping a stop card opens its detail view with full information:

| Field                | Description                                                        |
|----------------------|--------------------------------------------------------------------|
| **Type**             | Pickup, Delivery, etc. (editable)                                  |
| **Company Name**     | Full name                                                          |
| **Address**          | Full street address (only shown here, not on the card)             |
| **Expected Date/Time** | When the stop was scheduled                                      |
| **Actual Date/Time** | Editable — with a **"Now" button** that captures current timestamp |
| **Odometer Reading** | Optional numeric field — prompted but not required                 |
| **Notes**            | Free text field for any comments                                   |
| **Complete Button**  | Marks the stop as done                                             |

---

## Stop Completion Flow

When the driver is ready to complete a stop:

1. **Tap the checkbox** on the card (or tap "Complete" in the drill-down)
2. A **completion sheet** slides up with:
   - **Actual time** — pre-filled with current time, editable
   - **Odometer reading** — optional, easy to skip
   - **Confirm button**
3. Card updates:
   - Checkbox turns to green checkmark
   - Card background shifts to completed (green-tinted, muted)
   - Timeline connector above becomes solid green
4. Timeline progression visually advances to the next stop

---

## Late Indicator

- If `expected date < current date` AND the stop is NOT completed:
  - Expected date text turns **RED**
  - Optional small "LATE" badge next to the date

---

## Trip Summary Footer

At the bottom of the timeline (below the last stop), a summary section:

```
┌─────────────────────────────────────┐
│  TRIP SUMMARY                       │
│                                     │
│  Total Mileage ········· 487 mi     │
│  Revenue ··········· $1,215.00      │
│  Revenue/Mile ········ $2.49/mi     │
│  Stops ············ 3 of 5 complete │
│  Status ·········· In Progress      │
└─────────────────────────────────────┘
```

- Always visible at the bottom of the scrollable trip view
- Updates dynamically as stops are completed and data is entered
- **Revenue per mile** auto-calculates: `revenue / total mileage`

---

## Header

| Element          | Description                                    |
|------------------|------------------------------------------------|
| **Trip ID**      | Prominently displayed (e.g., "Trip #1092")     |
| **Progress**     | "3 of 5 stops complete"                        |
| **Progress bar** | Thin horizontal bar showing completion fraction |

---

## Bottom Action Bar

A contextual primary button at the bottom of the screen that changes based on trip state:

| Trip State         | Button Label     |
|--------------------|------------------|
| Not started        | "Start Trip"     |
| In progress        | "Complete Trip"  |
| All stops done     | "Finish Trip"    |

---

## Multi-Stop Scenarios

A trip can have any combination of stop types:

- **Simple**: `Empty Start → Pickup → Delivery`
- **Complex**: `Empty Start → Pickup → Pickup → Stop → Delivery → Delivery → Reposition`
- **With terminal**: `Empty Start → Pickup → Terminal → Delivery → Reposition`

---

## Open Questions / Future Considerations

- Integration with mapping API for automatic mileage calculation between stops
- GPS-based auto-detection of arrival at a stop
- Push notifications for late stops
- Photo capture at pickup/delivery for proof of delivery (POD)
- Signature capture on delivery
- Integration with ELD (Electronic Logging Device) data
