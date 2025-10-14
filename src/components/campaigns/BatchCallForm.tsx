import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Phone, Users, Zap, HelpCircle, Upload, RotateCcw, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { useBatchCall } from "@/hooks/useBatchCall";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function BatchCallForm() {
  // Use the shared batch call logic
  const {
    form,
    prompts,
    promptsLoading,
    lastCampaignData,
    validNumbers,
    invalidNumbers,
    isSubmitting,
    batchCallMutation,
    onSubmit,
    handleRepeatLast,
    handleFileUpload,
  } = useBatchCall();

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          {lastCampaignData && (
            <Button
              variant="outline"
              onClick={handleRepeatLast}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Ulangi Kempen Terakhir
            </Button>
          )}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => document.getElementById('file-upload')?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              Muat Naik Fail
            </Button>
            <input
              id="file-upload"
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Mulakan Kempen Batch Call
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="campaignName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Nama Kempen
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Berikan nama yang mudah diingat untuk kempen anda</p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Contoh: Panggilan Promo VTEC Sept 2025" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="promptId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          Pilih Skrip Prompt
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>AI akan menggunakan skrip ini untuk semua panggilan</p>
                            </TooltipContent>
                          </Tooltip>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih skrip untuk kempen ini" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {promptsLoading ? (
                              <SelectItem value="loading" disabled>
                                Memuat prompt...
                              </SelectItem>
                            ) : prompts?.length === 0 ? (
                              <SelectItem value="no-prompts" disabled>
                                Tiada prompt dijumpai. Cipta prompt dahulu.
                              </SelectItem>
                            ) : (
                              prompts?.map((prompt) => (
                                <SelectItem key={prompt.id} value={prompt.id}>
                                  {prompt.prompt_name}
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

                <FormField
                  control={form.control}
                  name="phoneNumbers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Senarai Nombor Telefon
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Masukkan satu nombor setiap baris. Format Malaysia: 01XXXXXXXX atau +601XXXXXXXX</p>
                          </TooltipContent>
                        </Tooltip>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Textarea 
                            placeholder="Masukkan satu nombor telefon setiap baris:
601137527311
0123456789
+60123456789"
                            className="min-h-[200px] font-mono text-sm pr-10"
                            {...field} 
                          />
                          {validNumbers.length > 0 && (
                            <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-green-500" />
                          )}
                          {invalidNumbers.length > 0 && (
                            <AlertCircle className="absolute top-3 right-3 h-5 w-5 text-red-500" />
                          )}
                        </div>
                      </FormControl>
                      
                      {/* Real-time validation feedback */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-4 text-sm">
                          {validNumbers.length > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              {validNumbers.length} nombor sah
                            </span>
                          )}
                          {invalidNumbers.length > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                              <AlertCircle className="h-4 w-4" />
                              {invalidNumbers.length} nombor tidak sah
                            </span>
                          )}
                        </div>
                        
                        {validNumbers.length > 0 && (
                          <div className="text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              Anggaran masa: ~{Math.ceil(validNumbers.length / 10) * 2} minit
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Auto Retry Configuration - Hidden */}
                {/* <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Auto Retry Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="retryEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between space-y-0">
                          <div className="space-y-0.5">
                            <FormLabel>Enable Auto Retry</FormLabel>
                            <div className="text-sm text-muted-foreground">
                              Automatically call back numbers that didn't answer
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {form.watch("retryEnabled") && (
                      <>
                        <FormField
                          control={form.control}
                          name="retryIntervalMinutes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                Retry Interval (Minutes)
                                <Tooltip>
                                  <TooltipTrigger>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Berapa minit nak tunggu sebelum call balik (5-1440 minit)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={5}
                                  max={1440}
                                  placeholder="30"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="maxRetryAttempts"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                Max Retry Attempts
                                <Tooltip>
                                  <TooltipTrigger>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Berapa kali nak cuba call balik (1-10 kali)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={1}
                                  max={10}
                                  placeholder="3"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </CardContent>
                </Card> */}

                <Button
                  type="submit"
                  disabled={isSubmitting || batchCallMutation.isPending || !prompts || prompts.length === 0 || validNumbers.length === 0 || invalidNumbers.length > 0}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting || batchCallMutation.isPending ? (
                    "Memulakan Kempen..."
                  ) : (
                    `Mulakan Batch Call (${validNumbers.length} nombor sah)`
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Phone Numbers Preview */}
        {(validNumbers.length > 0 || invalidNumbers.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Pratonton Nombor Telefon
                <span className="text-sm font-normal text-muted-foreground">
                  ({validNumbers.length + invalidNumbers.length} jumlah)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Valid Numbers */}
                {validNumbers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Nombor Sah ({validNumbers.length})
                    </h4>
                    <div className="max-h-32 overflow-y-auto">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
                        {validNumbers.slice(0, 50).map((number, index) => (
                          <div key={index} className="p-2 bg-green-50 border border-green-200 rounded text-center">
                            {number}
                          </div>
                        ))}
                        {validNumbers.length > 50 && (
                          <div className="p-2 text-muted-foreground text-center col-span-full">
                            ... dan {validNumbers.length - 50} nombor sah lagi
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Invalid Numbers */}
                {invalidNumbers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Nombor Tidak Sah ({invalidNumbers.length})
                    </h4>
                    <div className="max-h-32 overflow-y-auto">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
                        {invalidNumbers.slice(0, 20).map((number, index) => (
                          <div key={index} className="p-2 bg-red-50 border border-red-200 rounded text-center">
                            {number}
                          </div>
                        ))}
                        {invalidNumbers.length > 20 && (
                          <div className="p-2 text-muted-foreground text-center col-span-full">
                            ... dan {invalidNumbers.length - 20} nombor tidak sah lagi
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}