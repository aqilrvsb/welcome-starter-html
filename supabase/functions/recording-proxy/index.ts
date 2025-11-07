/**
 * Recording Proxy Edge Function
 *
 * Proxies recording files from FreeSWITCH servers through Supabase's valid HTTPS
 * This solves the mixed content / SSL certificate issue when playing recordings
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const server = url.searchParams.get('server');
    const file = url.searchParams.get('file');

    if (!server || !file) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: server and file' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate server IP (security check)
    const allowedServers = [
      '178.128.57.106',
      '159.223.45.224',
    ];

    if (!allowedServers.includes(server)) {
      return new Response(
        JSON.stringify({ error: 'Invalid server' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate file name (security check - prevent path traversal)
    if (file.includes('..') || file.includes('/') || file.includes('\\')) {
      return new Response(
        JSON.stringify({ error: 'Invalid file name' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📥 Proxying recording: ${file} from server ${server}`);

    // Fetch recording from FreeSWITCH server via HTTP (backend-to-backend)
    const recordingUrl = `http://${server}/recordings/${file}`;

    // Forward Range header for partial content support (needed for audio seeking)
    const rangeHeader = req.headers.get('range');
    const fetchHeaders: HeadersInit = {};
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const response = await fetch(recordingUrl, {
      headers: fetchHeaders,
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch recording: ${response.status}`);
      return new Response(
        JSON.stringify({ error: `Recording not found: ${response.status}` }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the audio data
    const audioData = await response.arrayBuffer();

    // Return the audio with proper headers
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': 'audio/wav',
      'Content-Length': audioData.byteLength.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    };

    // If this was a range request, return 206 Partial Content
    if (rangeHeader && response.status === 206) {
      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        responseHeaders['Content-Range'] = contentRange;
      }
      return new Response(audioData, {
        status: 206,
        headers: responseHeaders,
      });
    }

    console.log(`✅ Proxied recording: ${file} (${audioData.byteLength} bytes)`);

    return new Response(audioData, {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error('❌ Error proxying recording:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);
