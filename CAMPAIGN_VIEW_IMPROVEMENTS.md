# Campaign View Improvements

## Changes Needed:

### 1. Remove Buttons from Campaign Actions
**File:** `src/components/campaigns/CampaignActions.tsx`

Remove these items:
- Line 226-235: Repeat button (entire block with `<RotateCcw>`)
- Line 249-252: Duplicate menu item
- Line 270-273: Export Logs menu item

Keep only:
- Edit Campaign
- Pause/Resume Campaign (conditional)
- Delete Campaign

### 2. Remove Stage Analytics from Campaign Details
**File:** `src/components/campaigns/CampaignDetails.tsx`

- Remove import on line 13: `import { StageAnalytics } from "@/components/analytics/StageAnalytics";`
- Remove `<StageAnalytics>` component around line 279

### 3. Replace Stats Section with Dashboard-Style
**File:** `src/components/campaigns/CampaignDetails.tsx`

Replace the current stats cards section with dashboard-style cards showing:
- Total Calls
- Answered Calls
- Unanswered Calls
- Voicemail/Failed Calls
- Total Minutes Used
- Total Cost (VAPI + Twilio)

### 4. Replace "Log Panggilan Detail" with Full Call Logs Table
**File:** `src/components/campaigns/CampaignDetails.tsx`

At the bottom of the component, replace the simple log table with the complete Call Logs table from:
**Source:** `src/components/call-logs/CallLogsTable.tsx`

But filter it to show only calls from this campaign (`campaign_id = campaignId`)

The table should include all columns from Call Logs:
- No
- Nama Customer
- Prospect
- Product
- Prompt
- Campaign
- Details
- Stage
- Status
- Started At
- Duration
- Recording
- Transcript

## Implementation Priority:
1. Remove buttons (easy)
2. Remove Stage Analytics (easy)
3. Replace stats cards (medium)
4. Replace log table (complex - reuse CallLogsTable component)
