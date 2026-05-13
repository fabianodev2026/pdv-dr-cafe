-- Atualiza produtos com imagens ja existentes no Supabase Storage.
-- Bucket publico usado: produtos

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Pirulito%20Diploko.jfif'
where id = 78;

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Pirulito%20Futebol%20Americano.jfif'
where id = 90;

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Quadrado%20de%203%20queijos%20com%20peito%20de%20peru.jfif'
where id = 108;

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Red%20Bull.jfif'
where id = 81;

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Salgadinho%20Cheetos%20Lua.jfif'
where id = 77;

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Salgadinho%20Cheetos%20Onda.jfif'
where id = 76;

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Salgadinho%20Doritos.jfif'
where id = 70;

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Salgadinho%20Fandangos%20Presunto.jfif'
where id = 71;

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Salgadinho%20Torcida%20Bacon.jfif'
where id = 75;

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Salgadinho%20Torcida%20Churrasco.jfif'
where id = 73;

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Salgadinho%20Torcida%20Costelinha.jfif'
where id = 72;

update public.products
set image_url = 'https://ydgiskcczqvihzrunejd.supabase.co/storage/v1/object/public/produtos/Salgadinho%20Torcida%20Pimenta.jfif'
where id = 74;
