-- ============================================================================
-- WAIVER SIGNINGS CLEANUP SCRIPT
-- ============================================================================
-- Purpose: Remove duplicate waiver records and unsigned waivers
-- Target: waiver_signings table
--
-- Rules:
--   1. Delete all unsigned waivers (status != 'signed')
--   2. For duplicate signed waivers (same user_id + event_year + waiver_template_id), keep:
--      - First priority: The one linked to event_registrations
--      - Second priority: The most recently signed (by signed_at)
--
-- Note: waiver_template_id can be NULL - NULLs are treated as the same group
--
-- Usage:
--   1. Run SECTION 1 (Preview) to see what will be deleted
--   2. Review the output carefully
--   3. Run SECTION 2 (Cleanup) to perform the deletions
--   4. Run SECTION 3 (Verification) to confirm success
-- ============================================================================


-- ============================================================================
-- SECTION 1: PREVIEW - See what will be deleted (READ-ONLY)
-- ============================================================================

-- 1.0: TOTAL SUMMARY - All records that will be deleted
WITH unsigned_waivers AS (
    SELECT COUNT(*) as cnt FROM waiver_signings WHERE status != 'signed'
),
duplicate_signed AS (
    SELECT COALESCE(SUM(cnt - 1), 0) as cnt
    FROM (
        SELECT COUNT(*) as cnt
        FROM waiver_signings
        WHERE status = 'signed'
        GROUP BY user_id, event_year, waiver_template_id
        HAVING COUNT(*) > 1
    ) dups
)
SELECT
    (SELECT cnt FROM unsigned_waivers) as unsigned_waivers_to_delete,
    (SELECT cnt FROM duplicate_signed) as duplicate_signed_to_delete,
    (SELECT cnt FROM unsigned_waivers) + (SELECT cnt FROM duplicate_signed) as total_records_to_delete,
    (SELECT COUNT(*) FROM waiver_signings) as current_total_records;

-- 1.1: ALL records that will be deleted (comprehensive view)
WITH linked_waivers AS (
    SELECT DISTINCT waiver_signing_id
    FROM event_registrations
    WHERE waiver_signing_id IS NOT NULL
),
ranked_signed AS (
    SELECT
        ws.id,
        ROW_NUMBER() OVER (
            PARTITION BY ws.user_id, ws.event_year, COALESCE(ws.waiver_template_id, '')
            ORDER BY
                CASE WHEN lw.waiver_signing_id IS NOT NULL THEN 0 ELSE 1 END,
                COALESCE(ws.signed_at, ws.created_at) DESC
        ) as rn
    FROM waiver_signings ws
    LEFT JOIN linked_waivers lw ON ws.id = lw.waiver_signing_id
    WHERE ws.status = 'signed'
),
records_to_delete AS (
    -- All unsigned waivers
    SELECT id, 'UNSIGNED' as delete_reason
    FROM waiver_signings
    WHERE status != 'signed'
    UNION ALL
    -- Duplicate signed waivers (not the one we're keeping)
    SELECT ws.id, 'DUPLICATE_SIGNED' as delete_reason
    FROM waiver_signings ws
    INNER JOIN ranked_signed rs ON ws.id = rs.id
    WHERE rs.rn > 1
)
SELECT
    ws.id,
    ws.user_id,
    ws.event_year,
    ws.waiver_template_id,
    ws.status,
    ws.signer_email,
    ws.signed_at,
    ws.created_at,
    d.delete_reason
FROM waiver_signings ws
INNER JOIN records_to_delete d ON ws.id = d.id
ORDER BY d.delete_reason, ws.event_year, ws.waiver_template_id, ws.created_at DESC;

-- 1.2: Count of unsigned waivers to delete
SELECT
    'Unsigned waivers to delete' as description,
    COUNT(*) as count
FROM waiver_signings
WHERE status != 'signed';

-- 1.3: Breakdown of unsigned waivers by status
SELECT
    status,
    COUNT(*) as count
FROM waiver_signings
WHERE status != 'signed'
GROUP BY status
ORDER BY count DESC;

-- 1.4: Sample of unsigned waivers to be deleted (first 20)
SELECT
    id,
    user_id,
    event_year,
    status,
    signer_email,
    created_at,
    signed_at
FROM waiver_signings
WHERE status != 'signed'
ORDER BY created_at DESC
LIMIT 20;

-- 1.5: Find duplicate signed waivers (same user_id + event_year + waiver_template_id with multiple signed records)
SELECT
    user_id,
    event_year,
    COALESCE(waiver_template_id, '(no template)') as waiver_template_id,
    COUNT(*) as duplicate_count
FROM waiver_signings
WHERE status = 'signed'
GROUP BY user_id, event_year, waiver_template_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 1.6: Total count of duplicate signed waivers that will be deleted
WITH duplicates AS (
    SELECT
        user_id,
        event_year,
        waiver_template_id,
        COUNT(*) - 1 as extras
    FROM waiver_signings
    WHERE status = 'signed'
    GROUP BY user_id, event_year, waiver_template_id
    HAVING COUNT(*) > 1
)
SELECT
    'Duplicate signed waivers to delete' as description,
    COALESCE(SUM(extras), 0) as count
FROM duplicates;

-- 1.7: Preview which signed waivers will be KEPT (linked to registrations or most recent)
WITH linked_waivers AS (
    SELECT DISTINCT waiver_signing_id
    FROM event_registrations
    WHERE waiver_signing_id IS NOT NULL
),
ranked_waivers AS (
    SELECT
        ws.*,
        CASE WHEN lw.waiver_signing_id IS NOT NULL THEN 1 ELSE 0 END as is_linked,
        ROW_NUMBER() OVER (
            PARTITION BY ws.user_id, ws.event_year, COALESCE(ws.waiver_template_id, '')
            ORDER BY
                CASE WHEN lw.waiver_signing_id IS NOT NULL THEN 0 ELSE 1 END,
                COALESCE(ws.signed_at, ws.created_at) DESC
        ) as rn
    FROM waiver_signings ws
    LEFT JOIN linked_waivers lw ON ws.id = lw.waiver_signing_id
    WHERE ws.status = 'signed'
),
duplicate_groups AS (
    SELECT user_id, event_year, COALESCE(waiver_template_id, '') as template_group
    FROM waiver_signings
    WHERE status = 'signed'
    GROUP BY user_id, event_year, COALESCE(waiver_template_id, '')
    HAVING COUNT(*) > 1
)
SELECT
    rw.id,
    rw.user_id,
    rw.event_year,
    rw.waiver_template_id,
    rw.signer_email,
    rw.is_linked,
    rw.signed_at,
    rw.created_at,
    CASE WHEN rw.rn = 1 THEN 'KEEP' ELSE 'DELETE' END as action
FROM ranked_waivers rw
INNER JOIN duplicate_groups dg
    ON rw.user_id = dg.user_id
    AND rw.event_year = dg.event_year
    AND COALESCE(rw.waiver_template_id, '') = dg.template_group
ORDER BY rw.user_id, rw.event_year, rw.waiver_template_id, rw.rn;


-- ============================================================================
-- SECTION 2: CLEANUP - Execute the deletions
-- ============================================================================
-- IMPORTANT: Review SECTION 1 output before running this section!
-- This section is wrapped in a transaction - you can ROLLBACK if needed.
-- ============================================================================

BEGIN;

-- 2.1: Delete all unsigned waivers
DELETE FROM waiver_signings
WHERE status != 'signed';

-- Show count deleted
-- (Run this after the DELETE to see how many were removed)

-- 2.2: Delete duplicate signed waivers, keeping the best one per user/year/template
-- Priority: 1) Linked to event_registration, 2) Most recently signed
WITH linked_waivers AS (
    SELECT DISTINCT waiver_signing_id
    FROM event_registrations
    WHERE waiver_signing_id IS NOT NULL
),
waivers_to_keep AS (
    SELECT DISTINCT ON (ws.user_id, ws.event_year, COALESCE(ws.waiver_template_id, '')) ws.id
    FROM waiver_signings ws
    LEFT JOIN linked_waivers lw ON ws.id = lw.waiver_signing_id
    WHERE ws.status = 'signed'
    ORDER BY
        ws.user_id,
        ws.event_year,
        COALESCE(ws.waiver_template_id, ''),
        CASE WHEN lw.waiver_signing_id IS NOT NULL THEN 0 ELSE 1 END,
        COALESCE(ws.signed_at, ws.created_at) DESC
)
DELETE FROM waiver_signings ws
WHERE ws.status = 'signed'
  AND ws.id NOT IN (SELECT id FROM waivers_to_keep);

-- If everything looks good, commit:
COMMIT;

-- If you need to undo, use ROLLBACK instead of COMMIT


-- ============================================================================
-- SECTION 3: VERIFICATION - Confirm cleanup was successful
-- ============================================================================

-- 3.1: Confirm no unsigned waivers remain
SELECT
    'Unsigned waivers remaining' as description,
    COUNT(*) as count
FROM waiver_signings
WHERE status != 'signed';

-- 3.2: Confirm no duplicates remain (should return 0 rows)
SELECT
    user_id,
    event_year,
    COALESCE(waiver_template_id, '(no template)') as waiver_template_id,
    COUNT(*) as count
FROM waiver_signings
WHERE status = 'signed'
GROUP BY user_id, event_year, waiver_template_id
HAVING COUNT(*) > 1;

-- 3.3: Summary of remaining waivers by year
SELECT
    event_year,
    COUNT(*) as signed_waivers
FROM waiver_signings
WHERE status = 'signed'
GROUP BY event_year
ORDER BY event_year;

-- 3.4: Total remaining records
SELECT
    'Total waiver records remaining' as description,
    COUNT(*) as count
FROM waiver_signings;

-- 3.5: Verify all remaining waivers are signed
SELECT
    status,
    COUNT(*) as count
FROM waiver_signings
GROUP BY status;
