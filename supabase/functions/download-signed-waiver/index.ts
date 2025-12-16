import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DownloadRequest {
  waiverSigningId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const boldsignApiKey = Deno.env.get('BOLDSIGN_API_KEY');
    if (!boldsignApiKey) {
      throw new Error('BOLDSIGN_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    // Get the JWT token from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid or expired token');
    }

    // Check if user has admin role
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(name)
      `)
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole) {
      throw new Error('User role not found');
    }

    const roleName = (userRole.roles as { name: string })?.name;
    if (roleName !== 'admin' && roleName !== 'super_admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    const { waiverSigningId }: DownloadRequest = await req.json();

    if (!waiverSigningId) {
      throw new Error('waiverSigningId is required');
    }

    // Get the waiver signing record to find the BoldSign document ID
    const { data: waiverSigning, error: waiverError } = await supabase
      .from('waiver_signings')
      .select('id, boldsign_document_id, status, signer_name, user_id, event_year')
      .eq('id', waiverSigningId)
      .single();

    if (waiverError || !waiverSigning) {
      throw new Error(`Waiver signing not found: ${waiverError?.message || 'Unknown error'}`);
    }

    if (waiverSigning.status !== 'signed') {
      throw new Error('Waiver has not been signed yet');
    }

    if (!waiverSigning.boldsign_document_id) {
      throw new Error('No BoldSign document ID associated with this waiver signing');
    }

    const documentId = waiverSigning.boldsign_document_id;
    console.log('Downloading document from BoldSign:', documentId);

    // BoldSign has different API endpoints for US and EU regions
    // Try US first, then EU if it fails
    const apiEndpoints = [
      'https://api.boldsign.com',
      'https://api-eu.boldsign.com',
    ];

    let boldsignResponse: Response | null = null;
    let lastError = '';

    for (const baseUrl of apiEndpoints) {
      const boldsignUrl = `${baseUrl}/v1/document/download?documentId=${encodeURIComponent(documentId)}&onBehalfOf=${encodeURIComponent('cactuscuphema@gmail.com')}`;
      console.log('Trying BoldSign URL:', boldsignUrl);

      const response = await fetch(boldsignUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': boldsignApiKey,
          'accept': 'application/json',
        },
      });

      console.log(`BoldSign response from ${baseUrl}:`, response.status);

      if (response.ok) {
        boldsignResponse = response;
        break;
      } else {
        const errorText = await response.text();
        console.error(`BoldSign API error from ${baseUrl}:`, errorText);
        lastError = `${baseUrl}: ${response.status} - ${errorText}`;
      }
    }

    if (!boldsignResponse || !boldsignResponse.ok) {
      throw new Error(`Failed to download document from BoldSign. Last error: ${lastError}`);
    }

    // Get the PDF content
    const pdfBuffer = await boldsignResponse.arrayBuffer();

    // Generate filename
    const signerName = waiverSigning.signer_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'unknown';
    const filename = `waiver_${signerName}_${waiverSigning.event_year}.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error in download-signed-waiver:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: error instanceof Error && error.message.includes('Unauthorized') ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
