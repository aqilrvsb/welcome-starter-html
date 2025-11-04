# Campaign Selector Enhancement

## Feature Request:
Add 3 options for campaign selection:
1. **No Campaign** (Optional) - Calls won't be grouped
2. **Create New Campaign** - Type new unique campaign name
3. **Select Existing Campaign** - Choose from dropdown, add calls to existing campaign

## Changes Needed:

### 1. Update `BatchCallForm.tsx`

Add these imports at the top:
```typescript
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery } from "@tanstack/react-query";
```

Add state to track campaign mode:
```typescript
export function BatchCallForm() {
  const [campaignMode, setCampaignMode] = useState<'none' | 'new' | 'existing'>('none');
  const { user } = useCustomAuth();

  // ... existing code ...

  // Fetch existing campaigns for dropdown
  const { data: existingCampaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns-list", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('campaigns')
        .select('id, campaign_name, total_numbers, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
```

Replace the campaign name field (lines 78-103) with this:
```typescript
{/* Campaign Selection Mode */}
<Card className="bg-muted/30">
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-2">
      Kempen (Optional)
      <Tooltip>
        <TooltipTrigger>
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          <p>Pilih sama ada nak cipta kempen baru, guna kempen sedia ada, atau tanpa kempen</p>
        </TooltipContent>
      </Tooltip>
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <RadioGroup value={campaignMode} onValueChange={(value: any) => {
      setCampaignMode(value);
      // Clear campaign name when mode changes
      if (value === 'none') {
        form.setValue('campaignName', '');
        form.setValue('existingCampaignId', undefined);
      }
    }}>
      {/* Option 1: No Campaign */}
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="none" id="none" />
        <Label htmlFor="none" className="font-normal cursor-pointer">
          Tanpa Kempen (Call logs sahaja)
        </Label>
      </div>

      {/* Option 2: Create New Campaign */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="new" id="new" />
          <Label htmlFor="new" className="font-normal cursor-pointer">
            Cipta Kempen Baru
          </Label>
        </div>
        {campaignMode === 'new' && (
          <div className="ml-6">
            <FormField
              control={form.control}
              name="campaignName"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Contoh: Panggilan Promo VTEC Sept 2025"
                      {...field}
                      onChange={async (e) => {
                        field.onChange(e);
                        // Check if campaign name already exists
                        if (e.target.value.trim()) {
                          const exists = existingCampaigns?.some(
                            c => c.campaign_name.toLowerCase() === e.target.value.toLowerCase()
                          );
                          if (exists) {
                            form.setError('campaignName', {
                              message: '⚠️ Nama kempen ini sudah wujud. Sila guna nama lain atau pilih "Guna Kempen Sedia Ada"'
                            });
                          } else {
                            form.clearErrors('campaignName');
                          }
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>

      {/* Option 3: Use Existing Campaign */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="existing" id="existing" />
          <Label htmlFor="existing" className="font-normal cursor-pointer">
            Guna Kempen Sedia Ada
          </Label>
        </div>
        {campaignMode === 'existing' && (
          <div className="ml-6">
            <FormField
              control={form.control}
              name="existingCampaignId"
              render={({ field }) => (
                <FormItem>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Set campaign name from selected campaign
                      const selected = existingCampaigns?.find(c => c.id === value);
                      if (selected) {
                        form.setValue('campaignName', selected.campaign_name);
                      }
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kempen sedia ada" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {campaignsLoading ? (
                        <SelectItem value="loading" disabled>
                          Memuat kempen...
                        </SelectItem>
                      ) : existingCampaigns?.length === 0 ? (
                        <SelectItem value="no-campaigns" disabled>
                          Tiada kempen dijumpai. Cipta kempen baru.
                        </SelectItem>
                      ) : (
                        existingCampaigns?.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.campaign_name} ({campaign.total_numbers} calls)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
    </RadioGroup>
  </CardContent>
</Card>
```

### 2. Update `useBatchCall.ts` hook

Update the schema to include existingCampaignId:
```typescript
const batchCallSchema = z.object({
  campaignName: z.string().optional(), // Can be empty or from existing campaign
  existingCampaignId: z.string().optional(), // ID of existing campaign if selected
  promptId: z.string().min(1, "Sila pilih prompt"),
  phoneNumbers: z.string().min(1, "Senarai nombor telefon diperlukan"),
  retryEnabled: z.boolean().default(false),
  retryIntervalMinutes: z.number().min(5).max(1440).default(30),
  maxRetryAttempts: z.number().min(1).max(10).default(3),
});
```

Update default values:
```typescript
defaultValues: {
  campaignName: "",
  existingCampaignId: undefined,
  promptId: "",
  phoneNumbers: "",
  retryEnabled: false,
  retryIntervalMinutes: 30,
  maxRetryAttempts: 3,
},
```

### 3. Update Backend `ai-call-handler-freeswitch/index.ts`

Modify the `handleBatchCall` function around line 381-440:

```typescript
async function handleBatchCall(req: Request): Promise<Response> {
  try {
    const { userId, campaignName, existingCampaignId, promptId, phoneNumbers, phoneNumbersWithNames } = await req.json();

    if (!userId || !phoneNumbers) {
      throw new Error('Missing userId or phoneNumbers');
    }

    // ... existing validation code ...

    // 🎯 CAMPAIGN HANDLING: 3 scenarios
    let campaign = null;

    if (existingCampaignId) {
      // SCENARIO 1: Add to existing campaign
      const { data: existingCampaign, error: fetchError } = await supabaseAdmin
        .from('campaigns')
        .select('*')
        .eq('id', existingCampaignId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !existingCampaign) {
        throw new Error('Existing campaign not found or unauthorized');
      }

      campaign = existingCampaign;

      // Update total numbers count
      await supabaseAdmin
        .from('campaigns')
        .update({
          total_numbers: (existingCampaign.total_numbers || 0) + phoneNumbers.length,
          status: 'in_progress' // Reactivate if completed
        })
        .eq('id', existingCampaignId);

      console.log(`✅ Adding ${phoneNumbers.length} calls to existing campaign: ${campaign.campaign_name} (ID: ${campaign.id})`);

    } else if (campaignName?.trim()) {
      // SCENARIO 2: Create new campaign
      const { data: createdCampaign, error: campaignError } = await supabaseAdmin
        .from('campaigns')
        .insert({
          user_id: userId,
          campaign_name: campaignName.trim(),
          prompt_id: promptId,
          status: 'in_progress',
          total_numbers: phoneNumbers.length,
        })
        .select()
        .single();

      if (campaignError) {
        console.error('❌ Failed to create campaign:', campaignError);
        throw new Error('Failed to create campaign: ' + campaignError.message);
      }

      campaign = createdCampaign;
      console.log(`✅ Campaign created: ${campaign.campaign_name} (ID: ${campaign.id})`);

    } else {
      // SCENARIO 3: No campaign - calls go directly to call_logs
      console.log(`⏭️  No campaign provided - creating call logs without campaign`);
    }

    // ... rest of the code stays the same ...
  }
}
```

## Result:

User can now:
1. ✅ Skip campaign (optional)
2. ✅ Create new campaign with unique name validation
3. ✅ Add calls to existing campaign from dropdown
4. ✅ See call count for each existing campaign

## UI Preview:

```
┌─────────────────────────────────────────┐
│ Kempen (Optional)                   ℹ️ │
├─────────────────────────────────────────┤
│ ○ Tanpa Kempen (Call logs sahaja)      │
│                                         │
│ ○ Cipta Kempen Baru                    │
│   ┌───────────────────────────────────┐ │
│   │ Nama kempen...                    │ │
│   └───────────────────────────────────┘ │
│                                         │
│ ○ Guna Kempen Sedia Ada                │
│   ┌───────────────────────────────────┐ │
│   │ Promo Sept (50 calls) ▼           │ │
│   └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```
