require('dotenv').config();
const supabase = require('./db/supabase');

async function seed() {
    const rooms = [
        { name: 'General', is_global: true, is_private: false },
        { name: 'Random', is_global: true, is_private: false },
    ];

    for (const room of rooms) {
        const { data, error } = await supabase
            .from('groups')
            .select('*')
            .eq('name', room.name)
            .eq('is_global', true)
            .single();

        if (!data) {
            console.log(`Creating global room: ${room.name}`);
            await supabase.from('groups').insert({
                ...room,
                owner_id: '00000000-0000-0000-0000-000000000000' // dummy owner for global room if needed, or null if schema allows. Actually, let's just not send owner_id if it works without it, or let's use a dummy. Wait, supabase allows null? Let's assume it allows null since it's a global room.
            });
        } else {
            console.log(`Global room ${room.name} already exists.`);
        }
    }
    console.log('Seeding complete.');
}

seed().catch(console.error);
