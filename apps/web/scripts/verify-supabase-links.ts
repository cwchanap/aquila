import { db } from '../src/lib/drizzle/db';
import { users } from '../src/lib/drizzle/schema';
import { createClient, type User as SupabaseUser } from '@supabase/supabase-js';
import { isNotNull } from 'drizzle-orm';

async function main() {
    console.log(
        'Starting verification of Supabase <-> ApplicationUser links...'
    );

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error(
            'Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
        );
        console.error('Please check your .env file or environment variables.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch all Supabase users
    console.log('Fetching Supabase users...');
    let allSupabaseUsers: SupabaseUser[] = [];
    let page = 1;
    let hasMore = true;

    try {
        // Note: listUsers is paginated. The limit is 1000 per page.
        // We might need to iterate if we have more users.
        while (hasMore) {
            const { data, error } = await supabase.auth.admin.listUsers({
                page,
                perPage: 1000,
            });
            if (error) {
                console.error('Error fetching Supabase users:', error);
                process.exit(1);
            }
            allSupabaseUsers = [...allSupabaseUsers, ...data.users];

            // Check if we need more pages
            if (data.users.length < 1000) {
                hasMore = false;
            } else {
                page++;
            }
        }
    } catch (err) {
        console.error('Exception fetching Supabase users:', err);
        process.exit(1);
    }

    console.log(`Found ${allSupabaseUsers.length} Supabase users.`);

    // 2. Fetch all Application Users with supabaseUserId
    console.log('Fetching Application Users...');
    let appUsers: {
        id: string;
        supabaseUserId: string | null;
        email: string;
    }[] = [];
    try {
        appUsers = await db.query.users.findMany({
            columns: {
                id: true,
                supabaseUserId: true,
                email: true,
            },
            where: isNotNull(users.supabaseUserId),
        });
    } catch (err) {
        console.error('Error fetching Application Users:', err);
        process.exit(1);
    }
    console.log(
        `Found ${appUsers.length} Application Users linked to Supabase.`
    );

    // 3. Analyze
    const supabaseUserIds = new Set(allSupabaseUsers.map(u => u.id));
    const appUserSupabaseIds = new Set(appUsers.map(u => u.supabaseUserId));

    const missingInApp = allSupabaseUsers.filter(
        u => !appUserSupabaseIds.has(u.id)
    );
    const missingInSupabase = appUsers.filter(
        u => u.supabaseUserId && !supabaseUserIds.has(u.supabaseUserId)
    );

    console.log('\nResults:');
    console.log('----------------------------------------');
    console.log(
        `Supabase users without Application User: ${missingInApp.length}`
    );
    if (missingInApp.length > 0) {
        console.log('IDs of missing users (need to sign in to create):');
        missingInApp.forEach(u => console.log(` - ${u.id} (${u.email})`));
    }

    console.log(
        `\nApplication Users with invalid Supabase ID: ${missingInSupabase.length}`
    );
    if (missingInSupabase.length > 0) {
        console.log('IDs of orphaned app users (need cleanup):');
        missingInSupabase.forEach(u =>
            console.log(
                ` - AppID: ${u.id}, SupabaseID: ${u.supabaseUserId} (${u.email})`
            )
        );
    }
    console.log('----------------------------------------');

    if (missingInApp.length === 0 && missingInSupabase.length === 0) {
        console.log('\n✅ Verification PASSED: All records are consistent.');
        process.exit(0);
    } else {
        console.log('\n⚠️ Verification FAILED: Inconsistencies found.');
        // Exit with code 1 so CI fails when verification fails.
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
