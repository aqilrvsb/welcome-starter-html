# Pro Account & Dynamic Pricing Implementation Guide

## Phase 1: Completed ✅

### Database Schema
- ✅ `feature_requests` table - Client roadmap feature requests with status tracking
- ✅ `pro_applications` table - Pro account application with document uploads
- ✅ `system_settings` table - Dynamic system configuration (pricing, SIP defaults, etc.)
- ✅ Storage bucket `pro-applications` for document uploads
- ✅ RLS policies for all new tables
- ✅ Helper functions: `get_setting()`, `get_setting_numeric()`

### Client-Side Pages Created
- ✅ `/roadmap` - Feature request submission and status tracking
- ✅ `/pro-application` - Pro account application with 4 file uploads:
  - Registration Service Form (PDF)
  - Company Registration Form (PDF)
  - SSM Document (PDF)
  - Telco Profile Image (JPG/PNG)
- ✅ Added to client sidebar navigation

### Admin Pages Created
- ✅ `/admin/waiting-list` - Review Pro applications, configure SIP
- ✅ `/admin/feature-requests` - Manage client feature requests
- ✅ `/admin/settings` - System-wide settings (pricing, trial minutes, SIP defaults)
- ✅ Added to admin sidebar navigation

### Routes Added
- ✅ All client and admin routes registered in App.tsx
- ✅ Protected with authentication

---

## Phase 2: TODO - Dynamic Pricing Implementation

### Required Changes

#### 1. Update All Frontend Components
Replace all hardcoded `0.15` pricing with dynamic fetch from `system_settings`:

**Files to Update:**
- `src/pages/CreditsTopup.tsx` - Lines 264, 368, 388
- `src/pages/Dashboard.tsx` - Any pricing display
- `src/components/settings/PhoneConfigForm.tsx` - Lines 273, 292
- Any component displaying "RM 0.15/min"

**Implementation:**
```typescript
// Add to each component
const [pricingPerMinute, setPricingPerMinute] = useState(0.15);

useEffect(() => {
  const fetchPricing = async () => {
    const { data } = await supabase
      .rpc('get_setting_numeric', { key: 'pricing_per_minute' });
    if (data) setPricingPerMinute(parseFloat(data));
  };
  fetchPricing();
}, []);

// Then use: RM{pricingPerMinute}/min
```

#### 2. Update Deno Deploy Handler
File: `supabase/functions/ai-call-handler-freeswitch/index.ts`

**Changes needed:**
1. At the start of WebSocket connection, fetch pricing:
```typescript
// Near line 800-900, after session creation
const { data: pricingData } = await supabaseAdmin
  .rpc('get_setting_numeric', { key: 'pricing_per_minute' });
const PRICE_PER_MINUTE = parseFloat(pricingData) || 0.15;
```

2. Replace all hardcoded `0.15` with `PRICE_PER_MINUTE` variable
   - Search for `0.15` in the file
   - Replace with dynamic variable
   - Store in session object for reuse

#### 3. Update Cost Calculation Functions
Any database functions that calculate costs need to use dynamic pricing:

**Create new function:**
```sql
CREATE OR REPLACE FUNCTION calculate_call_cost(duration_mins numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  price_per_min numeric;
BEGIN
  SELECT setting_value::numeric INTO price_per_min
  FROM system_settings
  WHERE setting_key = 'pricing_per_minute';

  RETURN duration_mins * COALESCE(price_per_min, 0.15);
END;
$$;
```

---

## Phase 3: TODO - Enhanced Admin Client Management

### Update AdminUsers Page
Add functionality to:

#### Password Management
```typescript
const handleResetPassword = async (userId: string, newPassword: string) => {
  // Admin can change client password
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword
  });
};
```

#### Wallet Management
```typescript
const handleAdjustWallet = async (userId: string, amount: number, description: string) => {
  // Add/subtract credits
  const { error } = await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_description: description
  });
};

const handleResetTrial = async (userId: string) => {
  // Reset trial minutes
  const { error } = await supabase
    .from('users')
    .update({
      trial_minutes_used: 0,
      trial_credits_claimed: false
    })
    .eq('id', userId);
};
```

#### SIP Configuration (Already implemented in AdminWaitingList)
Can reuse the SIP config dialog from AdminWaitingList page.

---

## Phase 4: TODO - Update Settings Page

### Remove SIP Configuration Section
File: `src/components/settings/PhoneConfigForm.tsx`

**Changes:**
1. Hide the entire SIP configuration form (lines 412-542)
2. Show different UI based on account type:

**For Trial Accounts:**
- Show trial claim button
- Show "Upgrade to Pro" CTA linking to `/pro-application`

**For Pro Accounts (Approved):**
- Show "SIP Configuration Active" badge
- Display: "Your SIP trunk has been configured by admin"
- Show a "View Configuration" button (read-only display)

**For Pro Accounts (Pending/Under Review):**
- Show "Application Pending" status
- Link to `/pro-application` to view status

**Implementation Template:**
```typescript
const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
const [accountType, setAccountType] = useState<'trial' | 'pro'>('trial');

useEffect(() => {
  // Load user account type and application status
  const loadStatus = async () => {
    const { data: userData } = await supabase
      .from('users')
      .select('account_type')
      .eq('id', user.id)
      .single();

    setAccountType(userData?.account_type || 'trial');

    if (userData?.account_type === 'trial') {
      // Check if they have a pending application
      const { data: appData } = await supabase
        .from('pro_applications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      setApplicationStatus(appData?.status || null);
    }
  };
  loadStatus();
}, [user]);

// Then render appropriate UI
```

---

## Testing Checklist

### Database & Migration
- [ ] Run migrations: `npx supabase db reset` (development)
- [ ] Verify all tables created with correct columns
- [ ] Verify RLS policies work (test as non-admin user)
- [ ] Test storage bucket permissions

### Client Workflow
- [ ] Submit feature request from `/roadmap`
- [ ] Upload 4 documents in `/pro-application`
- [ ] Verify files stored in Supabase Storage
- [ ] Check application status updates

### Admin Workflow
- [ ] View Pro applications in `/admin/waiting-list`
- [ ] Open and review all 4 documents
- [ ] Approve application and configure SIP
- [ ] Verify user upgraded to 'pro' account type
- [ ] Reject application with reason
- [ ] Verify rejection reason shows to client

### Feature Requests
- [ ] Admin can view all requests in `/admin/feature-requests`
- [ ] Admin can update status and add notes
- [ ] Client sees updated status in `/roadmap`

### System Settings
- [ ] Change pricing in `/admin/settings`
- [ ] Verify pricing updates everywhere (after Phase 2)
- [ ] Change trial minutes default
- [ ] Test SIP proxy defaults

### Dynamic Pricing (Phase 2)
- [ ] Frontend components fetch and display correct pricing
- [ ] Deno handler calculates costs with dynamic pricing
- [ ] Credits deduction uses correct pricing
- [ ] Invoice generation uses correct pricing

---

## Deployment Steps

### 1. Database Migrations
```bash
# Push migrations to production
npx supabase db push
```

### 2. Storage Bucket
```bash
# Ensure storage bucket is created (should be done via migration)
# Verify in Supabase Dashboard > Storage
```

### 3. Environment Variables
No new env variables needed for Phase 1.

### 4. Deploy Code
```bash
git add .
git commit -m "Add Pro Account application & dynamic pricing foundation"
git push origin master
```

### 5. Verify Production
- [ ] Check all new pages load
- [ ] Test file upload works
- [ ] Verify admin can access new pages
- [ ] Test RLS policies (login as regular user)

---

## Known Issues & Limitations

### Current Implementation
- File uploads limited to 10MB (configurable in migration)
- Only PDF and image formats allowed (JPG, PNG)
- No email notifications for status changes (future enhancement)
- SIP configuration is manual (future: auto-provision)

### Future Enhancements
1. **Email Notifications**
   - Notify client when application approved/rejected
   - Notify admin when new application submitted
   - Notify client when feature request status changes

2. **Automated SIP Provisioning**
   - API integration with AlienVOIP
   - Auto-create SIP accounts on approval

3. **Bulk Operations**
   - Approve/reject multiple applications
   - Bulk status update for feature requests

4. **Analytics**
   - Track application approval rate
   - Feature request trends
   - Dynamic pricing impact analysis

---

## File Structure Reference

```
src/
├── pages/
│   ├── Roadmap.tsx                     ✅ Created
│   ├── ProApplication.tsx              ✅ Created
│   └── admin/
│       ├── AdminWaitingList.tsx        ✅ Created
│       ├── AdminFeatureRequests.tsx    ✅ Created
│       └── AdminSettings.tsx           ✅ Created
├── components/
│   ├── AppSidebar.tsx                  ✅ Updated
│   ├── AdminSidebar.tsx                ✅ Updated
│   └── settings/
│       └── PhoneConfigForm.tsx         ⏳ TODO Phase 4
└── App.tsx                             ✅ Updated

supabase/
├── migrations/
│   ├── 20251027000000_add_feature_requests_and_pro_applications.sql  ✅ Created
│   └── 20251027000001_create_storage_buckets.sql                     ✅ Created
└── functions/
    └── ai-call-handler-freeswitch/
        └── index.ts                     ⏳ TODO Phase 2
```

---

## Admin Default Users

The system uses email-based admin detection. Current admin emails in RLS policies:
- `aqilzulkiflee@gmail.com`
- `admin@aicallpro.com`

To add more admins, update RLS policies in all 3 tables:
```sql
-- Update in each table's admin policies
WHERE users.email IN ('aqilzulkiflee@gmail.com', 'admin@aicallpro.com', 'new-admin@example.com')
```

---

## Support & Questions

For implementation questions or issues:
1. Check this guide first
2. Review database schema in migrations
3. Check console logs for detailed errors
4. Verify RLS policies if access denied errors occur

---

**Status:** Phase 1 Complete - Ready for Testing
**Next Steps:** Test Phase 1, then proceed to Phase 2 (Dynamic Pricing)
