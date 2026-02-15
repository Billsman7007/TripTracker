# Trip Persistence Implementation

## Overview
This document describes the implementation of trip persistence using Supabase. The trip detail screen now loads and saves stops to/from the database instead of using in-memory mock data.

## Changes Made

### 1. Database Schema Updates
- **Migration file**: `add-stop-type-migration.sql`
- Adds three new fields to the `stops` table:
  - `type` (TEXT): Stop type (empty_start, pickup, stop, terminal, delivery, reposition)
  - `notes` (TEXT): Stop-specific notes
  - `expected_date` (DATE): Expected date for the stop

**⚠️ IMPORTANT**: Run this migration in your Supabase SQL Editor before using the app:
```sql
-- See add-stop-type-migration.sql for the full migration
```

### 2. New Utility Functions (`lib/trips.ts`)
Created comprehensive CRUD operations for trips and stops:

- `getTenantId()`: Helper to get tenant_id from current user session
- `fetchTripStops(tripId)`: Load all stops for a trip
- `fetchTrip(tripId)`: Load a single trip
- `ensureTrip(tripId, tripReference?)`: Create trip if it doesn't exist
- `saveStop(tripId, uiStop, stopOrder)`: Insert or update a stop
- `deleteStop(stopId)`: Delete a stop
- `reorderStops(tripId, stopIds)`: Update stop_order for all stops
- `completeStop(stopId)`: Mark a stop as complete

Also includes conversion functions:
- `dbStopToUIStop()`: Convert database stop to UI format
- `uiStopToDBStop()`: Convert UI stop to database format
- `parseAddress()` / `formatAddress()`: Handle address parsing/formatting

### 3. Trip Detail Screen Updates (`app/trips/[id].tsx`)
- **Removed**: Hardcoded `MOCK_STOPS` data
- **Added**: 
  - `useEffect` hook to load stops from Supabase on mount
  - Loading state with spinner
  - Error handling with alerts
  - All operations now persist to database:
    - `handleSave()`: Saves stop edits
    - `handleComplete()`: Marks stop as complete
    - `handleDelete()`: Deletes stop and reorders remaining
    - `toggleComplete()`: Toggles completion status
    - `moveStop()`: Reorders stops
    - `addStop()`: Creates new stop

## How It Works

1. **On Mount**: 
   - Ensures trip exists in database (creates if needed)
   - Loads all stops for the trip
   - Displays loading spinner during fetch

2. **On Save**: 
   - Updates stop in database
   - Updates local state for immediate UI feedback

3. **On Reorder**: 
   - Updates local state immediately (optimistic update)
   - Persists new order to database
   - Reverts on error

4. **On Complete/Delete**: 
   - Updates database
   - Refreshes local state

## Data Flow

```
UI Stop (UIStop)
    ↓
uiStopToDBStop() conversion
    ↓
Database Stop (DatabaseStop)
    ↓
Supabase stops table
```

## Next Steps

1. **Run the migration**: Execute `add-stop-type-migration.sql` in Supabase SQL Editor

2. **Test the implementation**:
   - Navigate to a trip detail screen
   - Verify stops load from database
   - Test editing, completing, deleting, and reordering stops
   - Verify data persists after navigation

3. **Future enhancements**:
   - Add notes field to database (already in migration)
   - Add expected_date field to database (already in migration)
   - Consider adding real-time subscriptions for multi-user scenarios
   - Add optimistic updates with rollback on error
   - Add offline support with sync

## Notes

- The implementation uses tenant_id from `tenant_users` table for multi-tenancy
- Address parsing is basic - may need enhancement for complex addresses
- Date parsing handles common formats but may need refinement
- Error handling shows alerts - consider toast notifications for better UX
