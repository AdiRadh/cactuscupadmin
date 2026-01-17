import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@13.6.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendInvoicesRequest {
  waitlistEntryIds: string[];
}

interface InvoiceResult {
  waitlistEntryId: string;
  success: boolean;
  invoiceId?: string;
  stripeInvoiceId?: string;
  error?: string;
}

interface SendInvoicesResponse {
  success: boolean;
  results: InvoiceResult[];
  totalSent: number;
  totalFailed: number;
}

/**
 * Check if early bird pricing is currently active
 */
function isEarlyBirdActive(
  earlyBirdStart: string | null,
  earlyBirdEnd: string | null
): boolean {
  if (!earlyBirdStart || !earlyBirdEnd) return false;
  const now = Date.now();
  const start = new Date(earlyBirdStart).getTime();
  const end = new Date(earlyBirdEnd).getTime();
  return now >= start && now <= end;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY_PROD');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY_PROD not configured');
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
    console.log('[AUTH] Verifying user token...');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('[AUTH] Token verification failed:', {
        error: userError?.message,
        hasUser: !!user,
      });
      throw new Error('Invalid or expired token');
    }

    console.log('[AUTH] User verified:', {
      userId: user.id,
      email: user.email,
    });

    // Check if user has admin role
    // Note: Using .limit(1) instead of .single() to handle users with multiple roles
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        is_active,
        roles!inner(name)
      `)
      .eq('user_id', user.id);

    console.log('[AUTH] User roles query result:', {
      userId: user.id,
      rolesFound: userRoles?.length || 0,
      roles: userRoles?.map(r => ({
        roleId: r.role_id,
        roleName: (r.roles as { name: string })?.name,
        isActive: r.is_active,
      })),
      error: roleError?.message,
    });

    if (roleError) {
      console.error('[AUTH] Role query error:', roleError);
      throw new Error(`User role query failed: ${roleError.message}`);
    }

    if (!userRoles || userRoles.length === 0) {
      console.error('[AUTH] No roles found for user:', user.id);
      throw new Error('User role not found');
    }

    // Check if any active role is admin or super_admin
    const activeAdminRole = userRoles.find(r => {
      const roleName = (r.roles as { name: string })?.name;
      const isAdminRole = roleName === 'admin' || roleName === 'super_admin';
      return isAdminRole && r.is_active === true;
    });

    console.log('[AUTH] Admin role check:', {
      userId: user.id,
      hasActiveAdminRole: !!activeAdminRole,
      matchedRole: activeAdminRole ? (activeAdminRole.roles as { name: string })?.name : null,
    });

    if (!activeAdminRole) {
      const roleNames = userRoles.map(r => `${(r.roles as { name: string })?.name} (active: ${r.is_active})`).join(', ');
      console.error('[AUTH] Unauthorized - user roles:', roleNames);
      throw new Error(`Unauthorized: Admin access required. User has roles: [${roleNames}]`);
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { waitlistEntryIds }: SendInvoicesRequest = await req.json();

    if (!waitlistEntryIds || waitlistEntryIds.length === 0) {
      throw new Error('No waitlist entry IDs provided');
    }

    // Get site settings for event registration fee (including early bird)
    const { data: settings } = await supabase
      .from('site_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'supporter_entry_fee',
        'event_registration_fee',
        'event_registration_early_bird_fee',
        'event_registration_early_bird_end_date',
      ]);

    const settingsMap: Record<string, string> = {};
    for (const row of settings || []) {
      settingsMap[row.setting_key] = row.setting_value;
    }

    const regularEventRegFee = parseInt(
      settingsMap['supporter_entry_fee'] || settingsMap['event_registration_fee'] || '5000',
      10
    );

    // Check if event registration early bird is active
    const earlyBirdEventRegFeeStr = settingsMap['event_registration_early_bird_fee'];
    const earlyBirdEventRegEndDate = settingsMap['event_registration_early_bird_end_date'];
    const earlyBirdEventRegFee = earlyBirdEventRegFeeStr ? parseInt(earlyBirdEventRegFeeStr, 10) : null;

    const isEventRegEarlyBirdActive = (() => {
      if (!earlyBirdEventRegFee || !earlyBirdEventRegEndDate) return false;
      const now = new Date();
      const endDate = new Date(earlyBirdEventRegEndDate);
      return now < endDate;
    })();

    const eventRegFee = isEventRegEarlyBirdActive && earlyBirdEventRegFee
      ? earlyBirdEventRegFee
      : regularEventRegFee;

    const results: InvoiceResult[] = [];
    let totalSent = 0;
    let totalFailed = 0;

    for (const entryId of waitlistEntryIds) {
      try {
        // Fetch entry with user and tournament info (including early bird pricing)
        const { data: entry, error: entryError } = await supabase
          .from('tournament_waitlist')
          .select(`
            id,
            user_id,
            email,
            first_name,
            last_name,
            tournament_id,
            status,
            tournaments:tournament_id (
              id,
              name,
              registration_fee,
              early_bird_price,
              early_bird_start_date,
              early_bird_end_date
            )
          `)
          .eq('id', entryId)
          .single();

        if (entryError || !entry) {
          results.push({
            waitlistEntryId: entryId,
            success: false,
            error: `Entry not found: ${entryError?.message || 'Unknown error'}`,
          });
          totalFailed++;
          continue;
        }

        // Only process promoted entries
        if (entry.status !== 'promoted') {
          results.push({
            waitlistEntryId: entryId,
            success: false,
            error: `Entry status is '${entry.status}', must be 'promoted'`,
          });
          totalFailed++;
          continue;
        }

        const tournamentsData = entry.tournaments as {
          id: string;
          name: string;
          registration_fee: number;
          early_bird_price: number | null;
          early_bird_start_date: string | null;
          early_bird_end_date: string | null;
        }[] | {
          id: string;
          name: string;
          registration_fee: number;
          early_bird_price: number | null;
          early_bird_start_date: string | null;
          early_bird_end_date: string | null;
        } | null;
        const tournament = Array.isArray(tournamentsData) ? tournamentsData[0] : tournamentsData;

        if (!tournament) {
          results.push({
            waitlistEntryId: entryId,
            success: false,
            error: 'Tournament not found',
          });
          totalFailed++;
          continue;
        }

        // Determine tournament fee (use early bird if active)
        const earlyBirdActive = isEarlyBirdActive(
          tournament.early_bird_start_date,
          tournament.early_bird_end_date
        );
        const tournamentFee = (earlyBirdActive && tournament.early_bird_price != null)
          ? tournament.early_bird_price
          : tournament.registration_fee;

        // Check if user has event registration for 2026
        const { data: eventReg } = await supabase
          .from('event_registrations')
          .select('id')
          .eq('user_id', entry.user_id)
          .eq('event_year', 2026)
          .eq('payment_status', 'completed')
          .maybeSingle();

        const needsEventReg = !eventReg;
        const eventFee = needsEventReg ? eventRegFee : 0;
        const totalAmount = tournamentFee + eventFee;

        // Get or create Stripe customer
        let stripeCustomerId: string;

        // First check if user has a stripe_customer_id in profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', entry.user_id)
          .single();

        if (profile?.stripe_customer_id) {
          stripeCustomerId = profile.stripe_customer_id;
        } else {
          // Search for existing customer by email
          const existingCustomers = await stripe.customers.list({
            email: entry.email,
            limit: 1,
          });

          if (existingCustomers.data.length > 0) {
            stripeCustomerId = existingCustomers.data[0].id;
          } else {
            // Create new customer
            const newCustomer = await stripe.customers.create({
              email: entry.email,
              name: `${entry.first_name} ${entry.last_name}`,
              metadata: {
                user_id: entry.user_id,
                source: 'waitlist_invoice',
              },
            });
            stripeCustomerId = newCustomer.id;
          }

          // Update profile with stripe_customer_id
          await supabase
            .from('profiles')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', entry.user_id);
        }

        // Create Stripe invoice
        const invoice = await stripe.invoices.create({
          customer: stripeCustomerId,
          collection_method: 'send_invoice',
          days_until_due: 7,
          rendering: {
            template: 'inrtem_1SqLLY6yLGtdSunKkhwccdH1',
          },
          metadata: {
            waitlist_entry_id: entryId,
            tournament_id: tournament.id,
            user_id: entry.user_id,
          },
        });

        // Add tournament fee line item (uses early bird price if active)
        await stripe.invoiceItems.create({
          customer: stripeCustomerId,
          invoice: invoice.id,
          amount: tournamentFee,
          currency: 'usd',
          description: `${tournament.name} - Tournament Registration`,
        });

        // Add event registration fee if needed
        if (needsEventReg && eventFee > 0) {
          await stripe.invoiceItems.create({
            customer: stripeCustomerId,
            invoice: invoice.id,
            amount: eventFee,
            currency: 'usd',
            description: 'Cactus Cup 2026 - Supporter Entry',
          });
        }

        // Finalize and send the invoice
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.sendInvoice(invoice.id);

        // Calculate due date (7 days from now)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);

        // Insert invoice record into database
        const { data: invoiceRecord, error: insertError } = await supabase
          .from('waitlist_invoices')
          .insert({
            waitlist_entry_id: entryId,
            user_id: entry.user_id,
            tournament_id: tournament.id,
            stripe_invoice_id: finalizedInvoice.id,
            stripe_customer_id: stripeCustomerId,
            stripe_hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
            tournament_fee: tournamentFee,
            event_registration_fee: eventFee,
            total_amount: totalAmount,
            status: 'pending',
            due_date: dueDate.toISOString(),
            sent_at: new Date().toISOString(),
            includes_event_registration: needsEventReg,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting invoice record:', insertError);
          // Invoice was sent but record failed - still count as success but log error
        }

        // Update waitlist entry status to 'invoiced'
        await supabase
          .from('tournament_waitlist')
          .update({ status: 'invoiced' })
          .eq('id', entryId);

        results.push({
          waitlistEntryId: entryId,
          success: true,
          invoiceId: invoiceRecord?.id,
          stripeInvoiceId: finalizedInvoice.id,
        });
        totalSent++;

      } catch (err) {
        console.error(`Error processing entry ${entryId}:`, err);
        results.push({
          waitlistEntryId: entryId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        totalFailed++;
      }
    }

    const response: SendInvoicesResponse = {
      success: totalFailed === 0,
      results,
      totalSent,
      totalFailed,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-waitlist-invoices:', error);
    return new Response(
      JSON.stringify({
        success: false,
        results: [],
        totalSent: 0,
        totalFailed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: error instanceof Error && error.message.includes('Unauthorized') ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
