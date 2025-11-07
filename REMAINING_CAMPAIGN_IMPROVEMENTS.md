# Remaining Campaign View Improvements

## ✅ COMPLETED:
1. ContactBatchCallModal - Campaign selector added

## 🔄 IN PROGRESS:

### 1. Remove buttons from CampaignActions.tsx

**Lines to remove:**
- Lines 226-235: Repeat button
- Line 249-252: Duplicate menu item  
- Line 270-273: Export Logs menu item
- Lines 287-306: Repeat dialog (AlertDialog)

**Keep only:**
- Edit Campaign
- Delete Campaign  
- Delete dialog

### 2. Remove Stage Analytics from CampaignDetails.tsx

**Changes:**
- Line 13: Remove `import { StageAnalytics } from "@/components/analytics/StageAnalytics";`
- Around line 279: Remove `<StageAnalytics ...>` component

### 3. Replace Stats Cards (CampaignDetails.tsx)

**Current stats** (basic cards):
- Total Calls
- Successful
- Failed
- Success Rate

**Replace with Dashboard-style cards** showing:
- Total Campaigns (or Total Calls for this campaign)
- Total Contacts
- Total Minutes Used  
- Remaining Minutes
- Total Calls
- Answered
- Unanswered
- Voicemail/Failed

Use the same card styling as Dashboard.

### 4. Replace "Log Panggilan Detail" Table

**Current:** Simple table with limited columns

**Replace with:** Full CallLogsTable component from `src/components/call-logs/CallLogsTable.tsx`

**Filter:** Only show calls where `campaign_id = campaignId`

**Columns to include:**
- No
- Nama Customer
- Prospect
- Product  
- Prompt
- Campaign (will all be same)
- Details
- Stage
- Status
- Started At
- Duration
- Recording
- Transcript

The table from CallLogsTable.tsx already has all features:
- Sorting
- Filtering
- Pagination
- Audio playback
- Transcript viewing

Just need to pass `campaignId` as a filter prop.

## Implementation Order:
1. Remove buttons (simple deletions)
2. Remove Stage Analytics (simple deletion)
3. Update stats cards (medium - copy from Dashboard)
4. Replace table (medium - import CallLogsTable with filter)

All changes are in 2 files:
- `src/components/campaigns/CampaignActions.tsx`
- `src/components/campaigns/CampaignDetails.tsx`
