import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user ID from request body
    const requestBody = await req.json();
    const { userId } = requestBody;
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Verify user exists
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      throw new Error('User not found');
    }
    
    const user = { id: userData.id, username: userData.username };

    const { campaignName, promptId, phoneNumbers, phoneNumbersWithNames = [], customerName, retryEnabled, retryIntervalMinutes, maxRetryAttempts, idsale } = requestBody;

    console.log(`Starting batch call campaign: ${campaignName} for user: ${user.id}`);

    // Validate inputs - campaignName is now optional
    if (!phoneNumbers || !Array.isArray(phoneNumbers)) {
      throw new Error('Missing required parameters: phoneNumbers');
    }

    // Get user's API keys
    const { data: apiKeys, error: apiError } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (apiError || !apiKeys || !apiKeys.vapi_api_key) {
      throw new Error('VAPI API key not found. Please configure your API keys first.');
    }

    // Get user's Twilio phone configuration
    const { data: phoneConfig, error: phoneError } = await supabaseAdmin
      .from('phone_config')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (phoneError || !phoneConfig || !phoneConfig.twilio_phone_number || !phoneConfig.twilio_account_sid || !phoneConfig.twilio_auth_token) {
      throw new Error('Twilio configuration not found. Please configure your Twilio phone settings first.');
    }

    // Get the selected prompt - if promptId is null, use the most recent prompt
    let prompt;
    if (promptId) {
      const { data, error: promptError } = await supabaseAdmin
        .from('prompts')
        .select('*')
        .eq('id', promptId)
        .eq('user_id', user.id)
        .single();
      
      if (promptError || !data) {
        throw new Error('Prompt not found');
      }
      prompt = data;
      console.log('Fetched prompt by ID:', prompt.prompt_name, 'Last updated:', prompt.updated_at);
    } else {
      // Fetch the most recent prompt for retry calls
      const { data, error: promptError } = await supabaseAdmin
        .from('prompts')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (promptError || !data) {
        throw new Error('No prompts found. Please create a prompt first.');
      }
      prompt = data;
      console.log('Using most recent prompt:', prompt.prompt_name, 'Last updated:', prompt.updated_at);
    }

    // Try to get user's manual voice config first (highest priority)
    let manualVoiceId = null;
    let voiceSpeed = 0.8; // Default speed
    try {
      const { data: voiceConfig } = await supabaseAdmin
        .from('voice_config')
        .select('manual_voice_id, speed')
        .eq('user_id', user.id)
        .maybeSingle();
      
      console.log('Voice config from DB:', voiceConfig);
      
      if (voiceConfig && voiceConfig.manual_voice_id && voiceConfig.manual_voice_id.trim() !== '') {
        manualVoiceId = voiceConfig.manual_voice_id.trim();
      }
      if (voiceConfig && voiceConfig.speed !== null && voiceConfig.speed !== undefined) {
        voiceSpeed = voiceConfig.speed;
      }
      
      console.log('Using voice speed:', voiceSpeed);
    } catch (error) {
      console.log('Voice config table not ready yet or error:', error);
    }

    // Try to get user's voice config from agents table (fallback)
    const { data: userAgent, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('voice_provider, voice, agent_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    // Default voice with Sarah's proper voice ID
    const defaultVoice = {
      provider: '11labs',
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah's proper voice ID
      model: 'eleven_flash_v2_5',
      stability: 0.8,
      similarityBoost: 1,
      style: 0.0,
      useSpeakerBoost: false,
      speed: voiceSpeed,
      optimizeStreamingLatency: 4,
      autoMode: true,
      inputPunctuationBoundaries: [",", "،", "۔", "，", "."]
    };

    // Priority: manual voice ID > agent voice config > default
    let selectedVoice;
    if (manualVoiceId) {
      // Use manual voice ID with default ElevenLabs settings
      selectedVoice = {
        ...defaultVoice,
        voiceId: manualVoiceId
      };
      console.log('Using manual voice ID with speed:', selectedVoice.speed);
    } else if (userAgent && userAgent.voice_provider && userAgent.voice) {
      // Use agent voice config
      selectedVoice = {
        provider: userAgent.voice_provider === 'elevenlabs' ? '11labs' : userAgent.voice_provider,
        voiceId: userAgent.voice,
        model: userAgent.voice_provider === 'elevenlabs' ? 'eleven_flash_v2_5' : 
               userAgent.voice_provider === 'openai' ? 'gpt-4o-realtime' :
               userAgent.voice_provider === 'playht' ? 'PlayHT2.0-turbo' :
               userAgent.voice_provider === 'azure' ? 'azure' : defaultVoice.model,
        stability: 0.8,
        similarityBoost: 1,
        style: 0.0,
        useSpeakerBoost: false,
        speed: voiceSpeed,
        optimizeStreamingLatency: 4,
        autoMode: true,
        inputPunctuationBoundaries: [",", "،", "۔", "，", "."]
      };
      console.log('Using agent voice config with speed:', selectedVoice.speed);
    } else {
      // Use default voice (Sarah)
      selectedVoice = defaultVoice;
      console.log('Using default voice with speed:', selectedVoice.speed);
    }

    console.log('Final selected voice config:', JSON.stringify(selectedVoice, null, 2));

    // Validate and format phone numbers
    const validPhones: string[] = [];
    const invalidPhones: string[] = [];

    for (const phone of phoneNumbers) {
      const cleanPhone = phone.replace(/[^0-9+]/g, '').trim();
      
      if (!cleanPhone) {
        invalidPhones.push(phone);
        continue;
      }

      // Format to E164
      let formattedPhone: string;
      if (cleanPhone.startsWith('+')) {
        formattedPhone = cleanPhone;
      } else if (cleanPhone.startsWith('60')) {
        formattedPhone = '+' + cleanPhone;
      } else if (cleanPhone.startsWith('0')) {
        formattedPhone = '+6' + cleanPhone;
      } else {
        formattedPhone = '+60' + cleanPhone;
      }

      if (formattedPhone.length >= 12 && formattedPhone.length <= 15) {
        validPhones.push(formattedPhone);
      } else {
        invalidPhones.push(phone);
      }
    }

    if (validPhones.length === 0) {
      throw new Error('No valid phone numbers provided');
    }

    // ✨ OPTIONAL CAMPAIGN: Only create campaign if campaignName is provided
    let campaign = null;
    let campaignId = null;

    if (campaignName && campaignName.trim() !== '') {
      // Create campaign record with retry settings
      const { data: campaignData, error: campaignError } = await supabaseAdmin
        .from('campaigns')
        .insert({
          user_id: user.id,
          campaign_name: campaignName,
          prompt_id: prompt.id,
          status: 'in_progress',
          total_numbers: validPhones.length,
          retry_enabled: retryEnabled || false,
          retry_interval_minutes: retryIntervalMinutes || 30,
          max_retry_attempts: maxRetryAttempts || 3,
          current_retry_count: 0
        })
        .select()
        .single();

      if (campaignError) {
        throw new Error('Failed to create campaign: ' + campaignError.message);
      }

      campaign = campaignData;
      campaignId = campaign.id;
      console.log(`Created campaign ${campaign.id} with ${validPhones.length} valid numbers`);
    } else {
      console.log(`No campaign name provided - calls will appear in Call Logs only (${validPhones.length} valid numbers)`);
    }

    // Full assistant configuration (from your PHP code)
    const assistantConfig = {
      name: 'AI Batch Call Agent',
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0.6
      },
      voice: selectedVoice,
      firstMessage: prompt.first_message,
      firstMessageMode: 'assistant-speaks-first',
      endCallMessage: 'Okay , terima kasih dan selamat sejahtera',
      voicemailMessage: 'RVSB',
      hipaaEnabled: false,
      clientMessages: [
        'function-call',
        'hang', 
        'tool-calls',
        'tool-calls-result',
        'tool.completed',
        'function-call-result'
      ],
      serverMessages: [
        'end-of-call-report',
        'hang',
        'function-call',
        'tool-calls'
      ],
      server: {
        url: 'https://ahexnoaazbveiyhplfrc.supabase.co/functions/v1/vapi-webhook',
        timeoutSeconds: 20
      },
      transcriber: {
        provider: 'azure',
        language: 'ms-MY',
        segmentationStrategy: 'Semantic',
        segmentationMaximumTimeMs: 20000,
        segmentationSilenceTimeoutMs: 100
      },
      startSpeakingPlan: {
        smartEndpointingPlan: {
          provider: 'vapi'
        }
      },
      voicemailDetection: {
        provider: 'vapi',
        backoffPlan: {
          maxRetries: 6,
          startAtSeconds: 5,
          frequencySeconds: 5
        },
        beepMaxAwaitSeconds: 0
      },
      artifactPlan: {
        recordingFormat: 'mp3'
      },
      backgroundSound: 'off',
      backgroundDenoisingEnabled: true,
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 0.4,
      interruptionsEnabled: false,
      llmRequestDelaySeconds: 0.1,
      numWordsToInterruptAssistant: 2,
      maxDurationSeconds: 600,
      backchannelingEnabled: false,
      modelOutputInMessagesEnabled: true,
      transportConfigurations: [
        {
          provider: 'twilio',
          timeout: 60,
          record: true,
          recordingChannels: 'dual'
        }
      ]
    };

    // Use user's Twilio configuration
    const twilioConfig = {
      twilioPhoneNumber: phoneConfig.twilio_phone_number,
      twilioAccountSid: phoneConfig.twilio_account_sid,
      twilioAuthToken: phoneConfig.twilio_auth_token,
    };

    // Create a map of phone numbers to customer names from the request
    const phoneToNameMap = new Map<string, string>();
    if (phoneNumbersWithNames && Array.isArray(phoneNumbersWithNames)) {
      phoneNumbersWithNames.forEach((item: any) => {
        if (item.phone_number && item.customer_name) {
          phoneToNameMap.set(item.phone_number, item.customer_name);
        }
      });
    }

    // Process all calls concurrently without chunking
    let successCount = 0;
    let failureCount = 0;

    console.log(`Processing ${validPhones.length} calls concurrently`);

    // Create promises for all calls
    const callPromises = validPhones.map(async (phoneNumber) => {
        // Get customer name from the map (passed from contacts)
        const customerNameFromRequest = phoneToNameMap.get(phoneNumber);
        
        // Get contact data for this phone number (outside try-catch so it's accessible in both blocks)
        const normalizePhone = (phone: string) => phone.replace(/[^0-9]/g, '');
        const targetNormalized = normalizePhone(phoneNumber);
        
        // Get all contacts for this user and find matching phone
        const { data: allContacts } = await supabaseAdmin
          .from('contacts')
          .select('id, name, phone_number')
          .eq('user_id', user.id);
        
        // Find contact with matching normalized phone number
        const contactData = allContacts?.find(contact => {
          const contactNormalized = normalizePhone(contact.phone_number);
          return contactNormalized === targetNormalized || 
                 contactNormalized === targetNormalized.slice(-9) || // Compare last 9 digits
                 targetNormalized.endsWith(contactNormalized);
        }) || null;

        try {
          // Function to replace variables in text
          const replaceVariables = (text: string) => {
            let result = text;
            
            // Priority logic for customer name:
            // 1. Use customerNameFromRequest (from contacts selection)
            // 2. Use contactData.name from contacts DB
            // 3. Use customerName from request (legacy)
            // 4. Fallback to "Cik" if all are missing or empty
            const nameToUse = customerNameFromRequest || (contactData && contactData.name) || customerName || "Cik";
            
            // Replace phone number variable
            result = result.replace(/\{\{CUSTOMER_PHONE_NUMBER\}\}/g, phoneNumber);
            
            // Replace customer name variables with priority logic
            result = result.replace(/\{\{customer_name\}\}/g, nameToUse);
            result = result.replace(/\{\{CUSTOMER_NAME\}\}/g, nameToUse);
            
            // Replace other common variables from prompt variables if defined
            if (prompt.variables && Array.isArray(prompt.variables)) {
              for (const variable of prompt.variables) {
                const variableName = variable.name;
                const placeholder = new RegExp(`\\{\\{${variableName}\\}\\}`, 'g');
                
                // Map common variable names to contact data
                switch (variableName.toLowerCase()) {
                  case 'customer_name':
                  case 'name':
                  case 'nama':
                    // Use the same priority logic for name variables
                    result = result.replace(placeholder, nameToUse);
                    break;
                  case 'phone_number':
                  case 'phone':
                  case 'telefon':
                    result = result.replace(placeholder, phoneNumber);
                    break;
                  // You can add more variable mappings here
                  default:
                    // For variables we don't know how to replace, keep them as is or provide defaults
                    result = result.replace(placeholder, `[${variableName}]`);
                    break;
                }
              }
            }
            
            return result;
          };

          // Replace variables in system prompt and first message
          const callSystemPrompt = replaceVariables(prompt.system_prompt);
          const callFirstMessage = replaceVariables(prompt.first_message);

          console.log(`Processing call for ${phoneNumber}, Contact: ${contactData?.name || 'Unknown'}`);
          console.log(`Original system prompt: ${prompt.system_prompt.substring(0, 50)}...`);
          console.log(`Replaced system prompt: ${callSystemPrompt.substring(0, 50)}...`);
          console.log(`Original first message: ${prompt.first_message}`);
          console.log(`Replaced first message: ${callFirstMessage}`);

          // Extract stages from system prompt using !!Stage [Name]!! pattern
          const extractStages = (text: string): string[] => {
            const stageRegex = /!!Stage\s+([^!]+?)!!/g;
            const stages: string[] = [];
            let match;
            
            while ((match = stageRegex.exec(text)) !== null) {
              const stageName = match[1].trim();
              if (stageName && !stages.includes(stageName)) {
                stages.push(stageName);
              }
            }
            
            return stages;
          };

          // Get stages from system prompt, fallback to default if none found
          const extractedStages = extractStages(prompt.system_prompt);
          const stagesList = extractedStages.length > 0 
            ? extractedStages 
            : ['Introduction', 'Fact Finding', 'Presentation', 'Closing', 'Confirmation'];

          console.log(`Extracted ${extractedStages.length} stages from prompt:`, stagesList);

          // Complete assistant configuration with tools and analysis
          const fullAssistantConfig = {
            ...assistantConfig,
            firstMessage: callFirstMessage,
            model: {
              ...assistantConfig.model,
              systemPrompt: callSystemPrompt,
              tools: [
                {
                  type: 'function',
                  function: {
                    name: 'send_whatsapp_tool',
                    description: 'Hantar mesej WhatsApp semasa panggilan dengan data pelanggan yang dikumpul',
                    parameters: {
                      type: 'object',
                      properties: {
                        phoneNumber: { type: 'string', description: 'Nombor telefon pelanggan (E164)' },
                        messageType: {
                          type: 'string',
                          description: 'Jenis mesej - nama template WhatsApp yang anda buat (contoh: test_gambar, order_confirmation, info_product)'
                        },
                        // Add dynamic properties from prompt variables
                        ...(prompt.variables && Array.isArray(prompt.variables) 
                          ? prompt.variables.reduce((acc: any, variable: any) => {
                              // Use variable name as-is for the parameter name
                              acc[variable.name] = {
                                type: 'string',
                                description: `${variable.description} - Akan diganti ke {{${variable.name}}} atau {${variable.name}} dalam template WhatsApp.`
                              }
                              return acc
                            }, {})
                          : {}
                        )
                      },
                      required: ['phoneNumber', 'messageType']
                    },
                  },
                },
                {
                  type: 'endCall',
                  function: {
                    name: 'end_call_tool',
                    description: 'End the phone call.',
                    parameters: { type: 'object', properties: {} },
                  },
                },
              ]
            },
            analysisPlan: {
              successEvaluationPrompt: 'Did the customer show interest or agree to purchase? Return TRUE if interested/purchased. Return FALSE if rejected.',
              successEvaluationRubric: 'PassFail',
              structuredDataPlan: {
                enabled: true,
                messages: [
                  {
                    role: 'system',
                    content: `Anda adalah seorang penganalisis panggilan jualan yang sangat teliti. Berdasarkan transkrip panggilan dan skrip prompt yang digunakan, sila analisis dan pulangkan data dalam format JSON.

**SKRIP PROMPT YANG DIGUNAKAN:**
${prompt.system_prompt}

**FIRST MESSAGE:**
${prompt.first_message}

${prompt.variables && Array.isArray(prompt.variables) && prompt.variables.length > 0 ? `
**VARIABLES YANG PERLU DIKUMPUL:**
${prompt.variables.map((v: any) => `- ${v.name}: ${v.description || 'No description'}`).join('\n')}

Sila extract maklumat untuk setiap variable dari transkrip panggilan. Jika maklumat tidak didapati, gunakan "Not provided".
` : ''}

Berdasarkan skrip di atas, tentukan peringkat mana pelanggan telah sampai dalam perbualan.

Json Schema: {{schema}}
Only respond with the JSON.`
                  },
                  {
                    role: 'user',
                    content: 'Here is the transcript: {{transcript}} . Here is the ended reason of the call: {{endedReason}}'
                  }
                ],
                schema: {
                  type: 'object',
                  properties: {
                    call_outcome: {
                      type: 'string',
                      enum: ['Answered', 'Not Answered'],
                      description: 'Sama ada panggilan dijawab oleh pelanggan atau tidak.'
                    },
                    stage_reached: {
                      type: 'string',
                      enum: stagesList,
                      description: 'Peringkat tertinggi yang dicapai dalam aliran perbualan berdasarkan prompt yang digunakan.'
                    },
                    is_closed: {
                      type: 'string',
                      enum: ['Yes', 'No'],
                      description: 'Sama ada objektif panggilan tercapai (contoh: jualan ditutup, temujanji ditetapkan, dll).'
                    },
                    reason_not_closed: {
                      type: 'string',
                      description: 'Sebab utama objektif tidak tercapai jika is_closed adalah No.'
                    },
                    ...(() => {
                      // Dynamically add properties for each variable defined by user
                      const dynamicProps: Record<string, any> = {};
                      if (prompt.variables && Array.isArray(prompt.variables)) {
                        for (const variable of prompt.variables) {
                          dynamicProps[variable.name] = {
                            type: 'string',
                            description: variable.description || `Data untuk ${variable.name} yang dikumpulkan semasa panggilan.`
                          };
                        }
                      }
                      return dynamicProps;
                    })()
                  },
                  required: ['call_outcome', 'stage_reached', 'is_closed']
                }
              }
            }
          };

          const postData = {
            assistant: fullAssistantConfig,
            phoneNumber: twilioConfig,
            customer: { number: phoneNumber },
            metadata: {
              call_type: 'full_backend_cold_call',
              customer_phone: phoneNumber,
              product: 'Vitamin VTEC',
              timestamp: new Date().toISOString(),
              batch_id: campaignId || null,
              campaign_id: campaignId || null,
              prompt_version: promptId,
              user_id: user.id  // Add user_id for webhook security
            }
          };

          console.log(`📞 Initiating call to ${phoneNumber}`);
          console.log(`   Twilio Account: ${twilioConfig.twilioAccountSid?.substring(0, 10)}...`);
          console.log(`   Twilio Phone: ${twilioConfig.twilioPhoneNumber}`);
          
          // Make call to VAPI API
          const response = await fetch('https://api.vapi.ai/call', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKeys.vapi_api_key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ VAPI API Error for ${phoneNumber}:`, {
              status: response.status,
              error: errorText.substring(0, 300),
              phone: phoneNumber
            });
            throw new Error(`VAPI API Error [${response.status}]: ${errorText.substring(0, 200)}`);
          }

          const responseData = await response.json();
          
          console.log(`✅ Call initiated successfully:`, {
            vapi_call_id: responseData.id,
            phone: phoneNumber,
            status: responseData.status,
            assistant_id: responseData.assistantId
          });

          // Log successful call (campaign_id is optional now)
          await supabaseAdmin.from('call_logs').insert({
            campaign_id: campaignId || null,
            user_id: user.id,
            contact_id: contactData?.id || null,
            call_id: responseData.id,
            phone_number: phoneNumber,
            vapi_call_id: responseData.id,
            status: responseData.status || 'initiated',
            agent_id: responseData.assistantId || '',
            caller_number: phoneNumber,
            start_time: new Date().toISOString(),
            idsale: idsale || null,
            customer_name: customerNameFromRequest || contactData?.name || customerName || null,
            metadata: {
              vapi_response: responseData,
              batch_call: true,
              customer_name: contactData?.name || null,
              twilio_config: {
                account_sid: twilioConfig.twilioAccountSid?.substring(0, 10) + '...',
                phone_number: twilioConfig.twilioPhoneNumber
              }
            }
          });

          console.log(`Successfully initiated call for ${phoneNumber}: ${responseData.id}`);
          return { success: true, phoneNumber, callId: responseData.id };

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to call ${phoneNumber}:`, errorMessage);
          
          // Log failed call with detailed error info (campaign_id is optional now)
          await supabaseAdmin.from('call_logs').insert({
            campaign_id: campaignId || null,
            user_id: user.id,
            contact_id: contactData?.id || null,
            call_id: `failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            phone_number: phoneNumber,
            status: 'failed',
            agent_id: '',
            caller_number: phoneNumber,
            start_time: new Date().toISOString(),
            idsale: idsale || null,
            customer_name: customerNameFromRequest || contactData?.name || customerName || null,
            metadata: {
              error: errorMessage,
              error_details: errorMessage,
              batch_call: true,
              customer_name: contactData?.name || null,
              failed_at: new Date().toISOString()
            }
          });

          return { success: false, phoneNumber, error: errorMessage };
        }
    });

    // Execute all calls concurrently
    const results = await Promise.all(callPromises);
    
    // Count successes and failures
    results.forEach(result => {
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    });

    console.log(`All calls completed: ${successCount} successful, ${failureCount} failed`);

    // Update campaign status (only if campaign was created)
    if (campaignId) {
      await supabaseAdmin
        .from('campaigns')
        .update({
          status: 'completed',
          successful_calls: successCount,
          failed_calls: failureCount
        })
        .eq('id', campaignId);
      console.log(`Campaign ${campaignId} updated. Success: ${successCount}, Failed: ${failureCount}`);
    } else {
      console.log(`No campaign created. Calls logged to Call Logs only. Success: ${successCount}, Failed: ${failureCount}`);
    }

    return new Response(JSON.stringify({
      message: campaignId ? `Batch call campaign completed successfully` : `Batch calls completed (call logs only)`,
      campaign_id: campaignId || null,
      summary: {
        total_provided: phoneNumbers.length,
        valid_numbers: validPhones.length,
        invalid_numbers: invalidPhones.length,
        successful_calls: successCount,
        failed_calls: failureCount
      },
      invalid_numbers: invalidPhones
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in batch-call function:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});