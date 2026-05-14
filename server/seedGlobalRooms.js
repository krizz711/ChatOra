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
            await supabase.from('groups').insert(room);
        } else {
            console.log(`Global room ${room.name} already exists.`);
        }
    }
    console.log('Seeding complete.');
}

seed().catch(console.error);
