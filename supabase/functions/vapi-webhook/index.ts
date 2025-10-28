import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Calculate Twilio cost based on duration and phone number
function calculateTwilioCost(durationSeconds: number, phoneNumber: string): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  
  const durationMinutes = Math.ceil(durationSeconds / 60); // Twilio bills in full minutes
  
  // Get country rate based on phone number prefix
  let ratePerMinute = 0.0085; // Default US/CA rate
  
  if (phoneNumber) {
    if (phoneNumber.startsWith('+60')) {
      ratePerMinute = 0.0130; // Malaysia rate
    } else if (phoneNumber.startsWith('+65')) {
      ratePerMinute = 0.0150; // Singapore rate
    } else if (phoneNumber.startsWith('+62')) {
      ratePerMinute = 0.0180; // Indonesia rate
    } else if (phoneNumber.startsWith('+66')) {
      ratePerMinute = 0.0160; // Thailand rate
    } else if (phoneNumber.startsWith('+84')) {
      ratePerMinute = 0.0200; // Vietnam rate
    } else if (phoneNumber.startsWith('+63')) {
      ratePerMinute = 0.0220; // Philippines rate
    } else if (phoneNumber.startsWith('+44')) {
      ratePerMinute = 0.0120; // UK rate
    } else if (phoneNumber.startsWith('+33')) {
      ratePerMinute = 0.0110; // France rate
    } else if (phoneNumber.startsWith('+49')) {
      ratePerMinute = 0.0100; // Germany rate
    }
  }
  
  return durationMinutes * ratePerMinute;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log('VAPI WEBHOOK RECEIVED:', JSON.stringify(payload, null, 2))

    const messageType = payload.message?.type
    const messageData = payload.message

    if (!messageType || !messageData) {
      console.log('Invalid webhook format')
      return new Response(
        JSON.stringify({ status: 'ignored', reason: 'Invalid format' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    switch (messageType) {
      case 'tool-calls':
      case 'function-call':
        return await processFunctionCall(supabase, messageData)

      case 'end-of-call-report':
        return await processEndOfCallReport(supabase, messageData)

      default:
        console.log(`Webhook type '${messageType}' received but ignored`)
        return new Response(
          JSON.stringify({ status: 'ignored' }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ status: 'error', message: (error as Error).message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})

async function processFunctionCall(supabase: any, messageData: any) {
  console.log('FUNCTION CALL RECEIVED:', messageData)
  
  try {
    const functionCalls = messageData.toolCalls || messageData.tool_calls || (messageData.functionCall ? [messageData.functionCall] : [])
    const results = []
    
    // Extract call metadata to get user_id
    const callMetadata = messageData.call?.metadata || messageData.metadata || {}

    for (const functionCall of functionCalls) {
      const functionName = functionCall.function?.name || functionCall.name
      const functionArgs = functionCall.function?.arguments || functionCall.arguments || {}

      console.log('PROCESSING FUNCTION CALL:', {
        function_name: functionName,
        arguments: functionArgs,
        metadata: callMetadata
      })

      switch (functionName) {
        case 'send_whatsapp_tool':
          console.log('🚀 SEND_WHATSAPP_TOOL TRIGGERED!', {
            phone_number: functionArgs.phoneNumber || 'NOT PROVIDED',
            message_type: functionArgs.messageType || 'NOT PROVIDED',
            user_id: callMetadata.user_id || 'NOT PROVIDED',
            timestamp: new Date().toISOString()
          })
          
          const whatsappResult = await handleWhatsAppTool(supabase, functionArgs, callMetadata)
          results.push({
            tool: 'send_whatsapp_tool',
            result: whatsappResult
          })
          break

        case 'end_call_tool':
          console.log('📞 END_CALL_TOOL TRIGGERED!', {
            arguments: functionArgs,
            timestamp: new Date().toISOString()
          })
          
          results.push({
            tool: 'end_call_tool',
            result: { success: true, message: 'Call ended' }
          })
          break

        default:
          console.log('⚠️ UNKNOWN FUNCTION CALL:', {
            function_name: functionName,
            arguments: functionArgs
          })
          
          results.push({
            tool: functionName,
            result: { error: 'Unknown function' }
          })
      }
    }

    console.log('FUNCTION CALL PROCESSING COMPLETED:', {
      total_calls: functionCalls.length,
      results: results
    })

    return new Response(
      JSON.stringify({
        status: 'success',
        processed_calls: functionCalls.length,
        results: results
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )

  } catch (error) {
    console.error('FUNCTION CALL PROCESSING ERROR:', error)
    return new Response(
      JSON.stringify({
        status: 'error',
        message: (error as Error).message || 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
}

async function handleWhatsAppTool(supabase: any, args: any, callMetadata: any = {}) {
  try {
    const phoneNumber = args.phoneNumber
    const messageType = args.messageType || 'testimonial_package'
    
    // Extract ALL parameters from args as dynamic customer data
    // This allows any custom variables from the prompt to be used
    const customerData: Record<string, any> = {
      phone: phoneNumber,
    }
    
    // Add all args (except phoneNumber and messageType) to customerData
    Object.keys(args).forEach(key => {
      if (key !== 'phoneNumber' && key !== 'messageType') {
        customerData[key] = args[key]
      }
    })
    
    console.log('📊 CUSTOMER DATA COLLECTED:', customerData)
    
    // Get user_id from call metadata (set when call was created)
    let userId: string | null = callMetadata.user_id || null
    
    console.log('📱 HANDLING WHATSAPP TOOL:', {
      phone: phoneNumber,
      message_type: messageType,
      user_id_from_metadata: userId,
      raw_args: args
    })

    if (!phoneNumber) {
      console.error('❌ WHATSAPP TOOL: Missing phone number')
      return {
        success: false,
        error: 'Phone number is required'
      }
    }
    
    if (!userId) {
      console.error('❌ WHATSAPP TOOL: Missing user_id in call metadata')
      return {
        success: false,
        error: 'User identification failed. Call metadata missing user_id.'
      }
    }

    // Clean phone number (remove + prefix, keep country code)
    const cleanPhone = phoneNumber.replace('+', '')
    
    // Get WAHA config for THIS specific user only
    const { data: phoneConfig, error: phoneConfigError } = await supabase
      .from('phone_config')
      .select('user_id, waha_session_name, waha_base_url, waha_api_key')
      .eq('user_id', userId)
      .not('waha_session_name', 'is', null)
      .maybeSingle()
    
    if (phoneConfigError || !phoneConfig) {
      console.error('❌ WHATSAPP: No WAHA session configured for this user:', {
        user_id: userId,
        error: phoneConfigError
      })
      return {
        success: false,
        error: 'WAHA session not configured for your account. Please configure WAHA in Settings > Phone Config.'
      }
    }

    const wahaSessionName = phoneConfig.waha_session_name
    const wahaBaseUrl = phoneConfig.waha_base_url || 'https://waha-plus-production-705f.up.railway.app'
    const wahaApiKey = phoneConfig.waha_api_key

    // Get message content (now async)
    const contentData = await getWhatsAppContent(messageType, customerData, userId, supabase)
    const message = contentData.message
    const imageUrls = contentData.image_urls || []

    console.log('📤 SENDING WHATSAPP MESSAGE:', {
      session: wahaSessionName,
      phone: cleanPhone,
      message_type: messageType,
      has_images: imageUrls.length > 0,
      image_count: imageUrls.length,
      api_url: wahaBaseUrl,
      message_preview: message.substring(0, 100)
    })
    
    // Validate image URLs if present
    if (imageUrls.length > 0) {
      console.log('🖼️ IMAGE URLs to send:', imageUrls)
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (wahaApiKey) {
      headers['X-Api-Key'] = wahaApiKey
    }

    // Send messages using WAHA API
    if (imageUrls.length > 0) {
      // Send images with caption (WAHA format)
      for (let i = 0; i < imageUrls.length; i++) {
        const caption = (i === 0 && message && message.trim() !== '') ? message : ''
        const postData = {
          session: wahaSessionName,
          chatId: `${cleanPhone}@c.us`,
          file: {
            mimetype: 'image/jpeg',
            url: imageUrls[i],
            filename: `image_${i}.jpg`
          },
          caption: caption
        }

        const wahaImageUrl = `${wahaBaseUrl}/api/sendImage`
        console.log(`📤 Sending image ${i + 1}/${imageUrls.length} to WAHA API...`, {
          api_url: wahaImageUrl,
          session: wahaSessionName,
          phone: cleanPhone,
          image_url: imageUrls[i],
          has_caption: caption.length > 0,
          caption_preview: caption.substring(0, 50)
        })
        
        const response = await fetch(wahaImageUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(postData)
        })

        const result = await response.text()
        console.log(`📸 Image ${i + 1}/${imageUrls.length} WAHA RAW response:`, {
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          body_preview: result.substring(0, 500)
        })

        if (!response.ok) {
          console.error(`❌ Failed to send image ${i + 1}:`, {
            status: response.status,
            response: result
          })
          throw new Error(`WAHA API error: ${response.status} - ${result}`)
        }

        // Try to parse and validate response
        try {
          const responseData = JSON.parse(result)
          console.log(`✅ Image ${i + 1} - WAHA Response parsed:`, {
            has_id: !!responseData.id,
            id: responseData.id,
            has_data: !!responseData._data
          })
          
          // Check if message was actually sent
          if (!responseData.id) {
            console.error(`⚠️ WARNING: Image ${i + 1} - No message ID returned, might not be sent!`)
          }
        } catch (parseError) {
          console.error(`⚠️ Could not parse WAHA response for image ${i + 1}:`, parseError)
        }

        if (i < imageUrls.length - 1) {
          // Wait 1 second between messages
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    } else {
      // Send text only
      const postData = {
        session: wahaSessionName,
        chatId: `${cleanPhone}@c.us`,
        text: message
      }

      const wahaTextUrl = `${wahaBaseUrl}/api/sendText`
      console.log('📤 Sending text message to WAHA API...')
      
      const response = await fetch(wahaTextUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(postData)
      })

      const result = await response.text()
      console.log('💬 Text message response:', {
        status: response.status,
        ok: response.ok,
        response: result
      })

      if (!response.ok) {
        console.error('❌ Failed to send text message:', {
          status: response.status,
          response: result
        })
        throw new Error(`WAHA API error: ${response.status} - ${result}`)
      }
    }

    console.log('✅ WHATSAPP SENT SUCCESSFULLY TO:', cleanPhone)

    return {
      success: true,
      message: 'WhatsApp message sent successfully',
      phone_number: cleanPhone,
      message_type: messageType
    }

  } catch (error) {
    console.error('❌ WHATSAPP TOOL ERROR:', error)
    return {
      success: false,
      error: (error as Error).message || 'Unknown error'
    }
  }
}

// Get WhatsApp message content based on message type from database
async function getWhatsAppContent(messageType: string, customerData: any, userId: string, supabaseClient: any) {
  try {
    console.log('🔍 FETCHING TEMPLATE:', {
      message_type: messageType,
      user_id: userId
    })
    
    // Try to get template from database
    const { data: template, error } = await supabaseClient
      .from('whatsapp_templates')
      .select('message_text, image_urls')
      .eq('user_id', userId)
      .eq('message_type', messageType)
      .maybeSingle()

    console.log('📋 TEMPLATE FETCH RESULT:', {
      found: !!template,
      error: error?.message,
      template_data: template
    })

    if (template && !error) {
      console.log('✅ USING CUSTOM TEMPLATE:', {
        message_type: messageType,
        message_preview: template.message_text.substring(0, 50),
        image_count: template.image_urls?.length || 0
      })
      
      // Replace ALL variables in message text dynamically
      let message = template.message_text
      
      // Replace all variables found in customerData
      // Support both {variable} and {{variable}} formats
      Object.keys(customerData).forEach(key => {
        const value = customerData[key]?.toString() || ''
        
        // Replace {key} format (single curly braces)
        const singleBraceRegex = new RegExp(`\\{${key}\\}`, 'gi')
        message = message.replace(singleBraceRegex, value)
        
        // Replace {{key}} format (double curly braces - from prompt variables)
        const doubleBraceRegex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi')
        message = message.replace(doubleBraceRegex, value)
      })
      
      console.log('🔄 VARIABLES REPLACED:', {
        original_length: template.message_text.length,
        replaced_length: message.length,
        available_variables: Object.keys(customerData)
      })
      
      const result = {
        message,
        image_urls: template.image_urls || []
      }
      
      console.log('📤 RETURNING TEMPLATE DATA:', {
        message_length: result.message.length,
        has_images: result.image_urls.length > 0
      })
      
      return result
    }
  } catch (error) {
    console.error('❌ ERROR FETCHING TEMPLATE:', error)
  }

  // Fallback to default templates if no custom template found
  console.log(`⚠️ NO CUSTOM TEMPLATE FOUND for "${messageType}", using fallback`)
  
  switch (messageType) {
    case 'product_gallery':
      return {
        message: "🌟 *KOLEKSI TERBARU VITAMIN VITAC* 🌟\n\n" +
                 "✔️ Bantu tingkatkan selera makan\n" +
                 "✔️ Kurangkan masalah sembelit\n" +
                 "✔️ Tingkatkan tenaga & imun badan\n\n" +
                 "🎁 *Promosi terhad sementara stok ada!*\n\n" +
                 "👉 Balas *'SAYA NAK'* sekarang untuk tempahan segera.",
        image_urls: [
          'https://ik.imagekit.io/vitac/vitac3.jpg?updatedAt=1758095802534',
          'https://ik.imagekit.io/vitac/vitac2.jpg?updatedAt=1758095801777',
          'https://ik.imagekit.io/vitac/vitacc.jpg?updatedAt=1758095801616'
        ]
      }

    case 'info_product':
      return {
        message: "👋 Salam cik, saya Ila dari HQ Vitac.\n\n" +
                 "Yang baru call cik tadi tu saya 😊.\n\n" +
                 "Saya nak share *info ringkas dan testimoni Vitac*:\n" +
                 "✅ Bahan semula jadi – Vitamin C, Zink, Serat Sayur\n" +
                 "✅ Selamat – Kilang GMP & lulus KKM\n" +
                 "✅ Sedap – Tablet kemam strawberi masam manis\n\n" +
                 "🎁 Bonus: Dengan pembelian 2 botol ke atas, cik layak masuk *cabutan bertuah* RM10,000 tunai + hadiah lain.\n\n",
        image_urls: [
          'https://chatbot.growrvsb.com/public/images/chatgpt/23141741666390',
          'https://chatbot.growrvsb.com/public/images/chatgpt/23141741665108',
          'https://chatbot.growrvsb.com/public/images/chatgpt/23141741665135',
          'https://chatbot.growrvsb.com/public/images/chatgpt/23141741665453'
        ]
      }

    case 'testimonial_package':
      return {
        message: "🌟 *TESTIMONI PENGGUNA VITAC* 🌟\n\n" +
                 "Ramai pelanggan dah rasa perubahan positif 💯\n" +
                 "Jom tengok hasil mereka 👇",
        image_urls: [
          'https://ik.imagekit.io/vitac/berat.jpeg?updatedAt=1758095802681',
          'https://ik.imagekit.io/vitac/selera.jpeg?updatedAt=1758095802486',
          'https://ik.imagekit.io/vitac/jarangsakit.jpeg?updatedAt=1758095802333',
          'https://ik.imagekit.io/vitac/sembelit.jpeg?updatedAt=1758095802298',
          'https://ik.imagekit.io/vitac/tidurlena.jpeg?updatedAt=1758095802194',
          'https://ik.imagekit.io/vitac/sensetive.jpeg?updatedAt=1758095801449'
        ]
      }

    case 'order_confirmation':
      const name = customerData.name || 'Pelanggan'
      const address = customerData.address || '(Alamat belum diisi)'
      const package_type = customerData.package_type || '(Pakej belum dipilih)'
      
      return {
        message: `✅ *PENGESAHAN TEMPAHAN*\n\n` +
                 `📦 Pakej: ${package_type}\n` +
                 `👤 Nama: ${name}\n` +
                 `📍 Alamat: ${address}\n\n` +
                 `Terima kasih atas tempahan anda! 🙏`,
        image_urls: []
      }

    default:
      return {
        message: "Terima kasih atas pertanyaan anda.",
        image_urls: []
      }
  }
}

// Get actual Twilio cost from Twilio API
const getTwilioCost = async (supabaseClient: any, callSid: string, userId: string): Promise<number> => {
  try {
    const response = await supabaseClient.functions.invoke('get-twilio-cost', {
      body: { callSid, userId }
    });

    if (response.error) {
      console.error('Error getting Twilio cost:', response.error);
      return 0;
    }

    return response.data?.cost || 0;
  } catch (error) {
    console.error('Error calling get-twilio-cost function:', error);
    return 0;
  }
};

// Send call data to ERP system
async function sendToERPSystem(callData: any, userId: string | null, supabaseClient: any) {
  if (!userId) {
    console.log('ℹ️ No userId provided, skipping ERP webhook')
    return
  }
  try {
    console.log('📤 SENDING TO ERP SYSTEM:', {
      call_id: callData.call_id,
      phone: callData.phone_number,
      user_id: userId
    })

    // Get ERP webhook URL from user's phone_config table
    const { data: config, error: configError } = await supabaseClient
      .from('phone_config')
      .select('erp_webhook_url')
      .eq('user_id', userId)
      .maybeSingle()

    if (configError || !config?.erp_webhook_url) {
      console.log('ℹ️ No ERP webhook configured for user:', userId)
      return
    }

    const erpWebhookUrl = config.erp_webhook_url

    console.log('🔗 ERP Webhook URL:', erpWebhookUrl)

    // Send data to ERP
    const response = await fetch(erpWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'call_completed',
        data: callData
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ ERP webhook failed:', {
        status: response.status,
        error: errorText
      })
      throw new Error(`ERP webhook returned ${response.status}: ${errorText}`)
    }

    const result = await response.text()
    console.log('✅ Successfully sent to ERP system:', {
      status: response.status,
      response: result.substring(0, 200)
    })

  } catch (error) {
    console.error('❌ ERROR sending to ERP:', error)
    throw error
  }
}

async function processEndOfCallReport(supabase: any, message: any) {
  console.log('END OF CALL REPORT RECEIVED:', {
    call_id: message.call?.id || message.id,
    customer: message.call?.customer?.number || message.customer?.number,
    timestamp: new Date().toISOString()
  })

  // Get VAPI call ID
  const vapiCallId = message.call?.id || message.id

  if (!vapiCallId) {
    console.error('END OF CALL: Missing VAPI call ID')
    return new Response(
      JSON.stringify({ status: 'error', message: 'Missing VAPI call ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  try {
    // Get phone number from call data
    const phoneNumber = message.call?.customer?.number || 
                       message.customer?.number ||
                       message.call?.metadata?.customer_phone ||
                       message.metadata?.customer_phone

    // Get campaign ID from call metadata if available
    const campaignId = message.call?.metadata?.campaign_id || 
                      message.metadata?.campaign_id ||
                      null

    // Get call SID for Twilio cost lookup
    const callSid = message.call?.transport?.callSid || message.call?.phoneCallProviderId

    // Determine user_id for Twilio cost lookup
    let userId: string | null = null
    
    try {
      if (campaignId) {
        const { data: campaignRow, error: campaignErr } = await supabase
          .from('campaigns')
          .select('user_id')
          .eq('id', campaignId)
          .maybeSingle()
        
        if (campaignErr) {
          console.error('Error fetching campaign user_id:', campaignErr)
        }
        if (campaignRow?.user_id) {
          userId = campaignRow.user_id
        }
      }
      
      if (!userId && phoneNumber) {
        const { data: numberRow, error: numberErr } = await supabase
          .from('numbers')
          .select('user_id')
          .eq('phone_number', phoneNumber)
          .maybeSingle()
        
        if (numberErr) {
          console.error('Error fetching numbers user_id:', numberErr)
        }
        if (numberRow?.user_id) {
          userId = numberRow.user_id
        }
      }
      
      if (!userId) {
        const assistantId = message.call?.assistantId || null
        if (assistantId) {
          const { data: apiRow, error: apiErr } = await supabase
            .from('api_keys')
            .select('user_id')
            .eq('assistant_id', assistantId)
            .maybeSingle()
          
          if (apiErr) {
            console.error('Error fetching api_keys user_id:', apiErr)
          }
          if (apiRow?.user_id) {
            userId = apiRow.user_id
          }
        }
      }
    } catch (uidErr) {
      console.error('Error resolving user_id for call log:', uidErr)
    }

    // Extract stage_reached from transcript by detecting !!Stage [Name]!! markers
    const transcript = message.transcript || '';
    let stageReached = 'Unknown';
    
    // Regular expression to find !!Stage [NAME]!! pattern
    const stageRegex = /!!Stage\s+([^!]+)!!/g;
    const stageMatches = [];
    let match;
    
    // Extract all stage markers from transcript
    while ((match = stageRegex.exec(transcript)) !== null) {
      const stageName = match[1].trim();
      stageMatches.push(stageName);
    }
    
    // Use the last detected stage as the final stage reached
    if (stageMatches.length > 0) {
      stageReached = stageMatches[stageMatches.length - 1];
      console.log('📍 STAGE DETECTED from transcript:', {
        all_stages: stageMatches,
        final_stage: stageReached
      });
    } else {
      // Fallback to structured data if no stage markers found in transcript
      const structuredData = message.analysis?.structuredData || {};
      stageReached = structuredData.stage_reached || 'Unknown';
      console.log('📍 STAGE from structured data (fallback):', stageReached);
    }
    
    // Extract other structured data from analysis
    const structuredData = message.analysis?.structuredData || {}
    const isClosed = (structuredData.is_closed || 'No') === 'Yes'
    const reasonNotClosed = structuredData.reason_not_closed || null
    const evaluationStatus = isClosed ? 'success' : 'failed'
    
    // Extract custom variables data (exclude system fields)
    const systemFields = ['call_outcome', 'stage_reached', 'is_closed', 'reason_not_closed'];
    const capturedData: Record<string, any> = {};
    for (const [key, value] of Object.entries(structuredData)) {
      if (!systemFields.includes(key) && value && value !== 'Not provided') {
        capturedData[key] = value;
      }
    }
    
    console.log('Captured custom variables:', capturedData);

    console.log(`📞 END OF CALL - Call ID: ${vapiCallId}`);
    console.log(`   Phone: ${phoneNumber}`);
    console.log(`   Campaign: ${campaignId}`);
    console.log(`   Ended Reason: ${message.endedReason}`);
    console.log(`   Duration: ${message.call?.duration || 0}s`);
    console.log(`   Cost: $${message.cost || 0}`);

    // Categorize end call reason from VAPI
    const endedReason = message.endedReason || 'unknown'
    
    // Log Twilio failures in detail and prepare error info for database
    let twilioErrorDetails = null;
    if (endedReason === 'twilio-failed-to-connect-call') {
      twilioErrorDetails = {
        error_type: 'twilio-failed-to-connect-call',
        sebab_utama: 'Twilio tidak dapat sambungkan panggilan',
        kemungkinan_punca: [
          'Twilio credentials tidak sah atau expired',
          'Format nombor telefon tidak betul',
          'Twilio account balance tidak mencukupi',
          'Nombor telefon belum verified (trial mode)',
          'Twilio phone number tidak active'
        ],
        langkah_debug: [
          'Semak Twilio credentials di Settings',
          'Verify Twilio account balance',
          'Test nombor di Twilio console',
          'Pastikan format nombor betul (+60XXXXXXXXX)'
        ]
      };
      
      console.error('===== TWILIO GAGAL CONNECT CALL =====');
      console.error(`Phone: ${phoneNumber}`);
      console.error(`VAPI Call ID: ${vapiCallId}`);
      console.error('SEBAB: Twilio tidak dapat sambungkan panggilan');
      console.error('=====================================');
    }
    let callOutcome = 'no_answer' // default
    
    // Determine call outcome based on ended reason and analysis
    if (endedReason === 'customer-ended-call' || endedReason === 'assistant-ended-call') {
      callOutcome = 'answered'
    } else if (endedReason === 'voicemail' || endedReason.includes('voicemail')) {
      callOutcome = 'voicemail'
    } else if (endedReason === 'no-answer' || endedReason === 'busy' || endedReason === 'failed') {
      callOutcome = 'no_answer'
    } else if (structuredData.call_outcome) {
      // Use structured data if available
      const outcome = structuredData.call_outcome.toLowerCase()
      if (outcome.includes('answer')) {
        callOutcome = 'answered'
      } else if (outcome.includes('voicemail')) {
        callOutcome = 'voicemail'
      }
    }

    // Convert duration to integer (round to nearest second)
    const durationSeconds = message.durationSeconds ? Math.round(parseFloat(message.durationSeconds)) : 0

    // Get costs separately
    const vapiCost = message.cost || 0;
    let twilioCost = 0;
    
    // Get actual Twilio cost if we have a call SID and user ID
    if (callSid && userId) {
      twilioCost = await getTwilioCost(supabase, callSid, userId);
    }
    
    const totalCost = vapiCost + twilioCost;

    console.log('END OF CALL: Processing data', {
      vapi_call_id: vapiCallId,
      phone_number: phoneNumber,
      campaign_id: campaignId,
      evaluation_status: evaluationStatus,
      duration: durationSeconds,
      vapi_cost: vapiCost,
      twilio_cost: twilioCost,
      total_cost: totalCost
    })

    // First, try to find existing call log by vapi_call_id
    let callLog = null
    const { data: existingCall, error: searchError } = await supabase
      .from('call_logs')
      .select('*')
      .eq('vapi_call_id', vapiCallId)
      .maybeSingle()

    if (searchError) {
      console.error('Error searching for existing call log:', searchError)
    }

    if (existingCall) {
      console.log('END OF CALL: Updating existing call log', { id: existingCall.id })
      
      // Update existing call log
      const { data: updatedCall, error: updateError } = await supabase
        .from('call_logs')
        .update({
          duration: durationSeconds,
          status: callOutcome,
          stage_reached: stageReached,
          end_of_call_report: message,
          vapi_call_id: vapiCallId,
          captured_data: capturedData,
          metadata: {
            structured_data: structuredData,
            stage_reached: stageReached,
            is_closed: isClosed,
            reason_not_closed: reasonNotClosed,
            evaluation_status: evaluationStatus,
            vapi_cost: vapiCost,
            twilio_cost: twilioCost,
            total_cost: totalCost,
            recording_url: message.recordingUrl,
            transcript: message.transcript,
            summary: message.summary,
            call_status: message.endedReason || 'unknown',
            call_outcome: callOutcome,
            ended_reason: endedReason,
            twilio_error: twilioErrorDetails
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCall.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating call log:', updateError)
        throw updateError
      }
      
      callLog = updatedCall
    } else {
      console.log('END OF CALL: No existing call log found, attempting to create new one')

      if (!userId) {
        console.error('END OF CALL: Could not resolve user_id; skipping insert')
        return new Response(
          JSON.stringify({ status: 'error', message: 'Could not resolve user_id' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }

      if (!phoneNumber) {
        console.error('END OF CALL: Missing customer phone number')
        return new Response(
          JSON.stringify({ status: 'error', message: 'Missing customer_phone' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        )
      }

      // Create new call log record
      const { data: newCall, error: insertError } = await supabase
        .from('call_logs')
        .insert({
          user_id: userId,
          campaign_id: campaignId,
          call_id: vapiCallId,
          agent_id: message.call?.assistantId || 'unknown',
          caller_number: phoneNumber,
          phone_number: phoneNumber,
          vapi_call_id: vapiCallId,
          start_time: message.call?.createdAt || new Date().toISOString(),
          duration: durationSeconds,
          status: callOutcome,
          stage_reached: stageReached,
          end_of_call_report: message,
          captured_data: capturedData,
          metadata: {
            structured_data: structuredData,
            stage_reached: stageReached,
            is_closed: isClosed,
            reason_not_closed: reasonNotClosed,
            evaluation_status: evaluationStatus,
            vapi_cost: vapiCost,
            twilio_cost: twilioCost,
            total_cost: totalCost,
            recording_url: message.recordingUrl,
            transcript: message.transcript,
            summary: message.summary,
            call_status: message.endedReason || 'unknown',
            call_outcome: callOutcome,
            ended_reason: endedReason
          }
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error inserting new call log:', insertError)
        throw insertError
      }
      
      callLog = newCall
    }

    // Update campaign statistics if campaign_id exists
    if (campaignId) {
      if (evaluationStatus === 'success') {
        await supabase.rpc('increment_campaign_success', { campaign_id: campaignId })
      } else {
        await supabase.rpc('increment_campaign_failed', { campaign_id: campaignId })
      }
    }

    console.log('END OF CALL: Record processed successfully', {
      phone: phoneNumber,
      record_id: callLog.id,
      is_closed: isClosed,
      stage: stageReached,
      campaign_id: campaignId,
      status: evaluationStatus
    })

    // Send data to ERP system (if configured)
    try {
      await sendToERPSystem({
        call_id: vapiCallId,
        phone_number: phoneNumber,
        campaign_id: campaignId,
        duration: durationSeconds,
        status: callOutcome,
        evaluation_status: evaluationStatus,
        stage_reached: stageReached,
        is_closed: isClosed,
        captured_data: capturedData,
        vapi_cost: vapiCost,
        twilio_cost: twilioCost,
        total_cost: totalCost,
        transcript: message.transcript,
        recording_url: message.recordingUrl,
        timestamp: new Date().toISOString()
      }, userId, supabase)
    } catch (erpError) {
      console.error('⚠️ Failed to send to ERP system (non-blocking):', erpError)
      // Don't fail the whole webhook if ERP fails
    }

    return new Response(
      JSON.stringify({ 
        status: 'success', 
        record_id: callLog.id,
        evaluation_status: evaluationStatus
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )

  } catch (processError) {
    console.error('Failed to process end-of-call:', processError)
    return new Response(
      JSON.stringify({ status: 'error', message: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
}