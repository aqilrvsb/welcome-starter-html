# Update ContactBatchCallModal with Campaign Selector

## File: `src/components/contacts/ContactBatchCallModal.tsx`

### Step 1: Add imports (at top of file after line 15):

```typescript
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery } from "@tanstack/react-query";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
```

### Step 2: Add state in component (after line 48):

```typescript
const [campaignMode, setCampaignMode] = React.useState<'none' | 'new' | 'existing'>('none');
const { user } = useCustomAuth();

// Fetch existing campaigns for dropdown
const { data: existingCampaigns, isLoading: campaignsLoading } = useQuery({
  queryKey: ["campaigns-list", user?.id],
  queryFn: async () => {
    if (!user) return [];

    const { data, error } = await supabase
      .from('campaigns')
      .select('id, campaign_name, total_numbers, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false});

    if (error) throw error;
    return data || [];
  },
  enabled: !!user && open,
});
```

### Step 3: Replace the campaignName field (lines 133-159) with:

```typescript
{/* Campaign Selection with 3 Options */}
<Card className="bg-muted/30">
  <CardHeader>
    <CardTitle className="text-sm flex items-center gap-2">
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

This will make the Contacts batch call modal look exactly like the Campaigns batch call form!
