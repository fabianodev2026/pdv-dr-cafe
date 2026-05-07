-- Catalogo inicial de produtos Dr. Cafe.
-- Rode no Supabase SQL Editor para cadastrar os itens do cardapio.
-- O script nao duplica produtos que ja existem com o mesmo nome.

alter table public.products
  add column if not exists category text not null default 'comida';

with catalog(name, unit_price, category, description) as (
  values
    -- Bebidas 350ml
    ('Sprite Zero Acucar 350ml', 7.50, 'bebida', 'Refrigerante 350ml'),
    ('Fanta Uva 350ml', 7.50, 'bebida', 'Refrigerante 350ml'),
    ('Coca-Cola 350ml', 7.50, 'bebida', 'Refrigerante 350ml'),
    ('Fanta Laranja 350ml', 7.50, 'bebida', 'Refrigerante 350ml'),
    ('Coca-Cola Zero 350ml', 7.50, 'bebida', 'Refrigerante 350ml'),
    ('Kuat 350ml', 7.50, 'bebida', 'Refrigerante 350ml'),
    ('Fanta Guarana 350ml', 7.50, 'bebida', 'Refrigerante 350ml'),
    ('Sprite Original 350ml', 7.50, 'bebida', 'Refrigerante 350ml'),
    ('Schweppes Citrus 350ml', 7.50, 'bebida', 'Refrigerante 350ml'),

    -- Bebidas 220ml
    ('Coca-Cola Cafe 220ml', 5.50, 'bebida', 'Refrigerante 220ml'),
    ('Coca-Cola Original 220ml', 5.50, 'bebida', 'Refrigerante 220ml'),
    ('Sprite Original 220ml', 5.50, 'bebida', 'Refrigerante 220ml'),
    ('Coca-Cola Zero 220ml', 5.50, 'bebida', 'Refrigerante 220ml'),
    ('Fanta Guarana 220ml', 5.50, 'bebida', 'Refrigerante 220ml'),
    ('Fanta Laranja 220ml', 5.50, 'bebida', 'Refrigerante 220ml'),
    ('Fanta Uva 220ml', 5.50, 'bebida', 'Refrigerante 220ml'),

    -- Outras bebidas
    ('Sprite Lemon Fresh 510ml', 8.00, 'bebida', 'Refrigerante 510ml'),
    ('Agua com Gas', 5.00, 'bebida', 'Agua'),
    ('Agua Mineral', 4.00, 'bebida', 'Agua'),
    ('Powerade Azul', 8.00, 'bebida', 'Isotonico'),
    ('Powerade Laranja', 8.00, 'bebida', 'Isotonico'),
    ('Monster Ultra', 12.00, 'bebida', 'Energetico'),
    ('Monster Absolutely Zero', 12.00, 'bebida', 'Energetico'),
    ('Monster Mango Loco', 12.00, 'bebida', 'Energetico'),
    ('Monster Original', 12.00, 'bebida', 'Energetico'),
    ('Del Valle Limonada Classic', 8.00, 'bebida', 'Suco Del Valle'),
    ('Del Valle Limonada Pink', 8.00, 'bebida', 'Suco Del Valle'),
    ('Suco Natural Laranja 350ml', 12.00, 'bebida', 'Suco natural'),
    ('Suco Natural Maracuja 350ml', 12.00, 'bebida', 'Suco natural'),
    ('Suco Natural Abacaxi 350ml', 12.00, 'bebida', 'Suco natural'),
    ('Suco Natural Acerola 350ml', 12.00, 'bebida', 'Suco natural'),
    ('Suco Natural Detox 350ml', 12.00, 'bebida', 'Suco natural'),
    ('Vitamina Frutas Vermelhas 350ml', 14.00, 'bebida', 'Vitamina'),
    ('Vitamina Banana 350ml', 14.00, 'bebida', 'Vitamina'),
    ('Vitamina Morango 350ml', 14.00, 'bebida', 'Vitamina'),
    ('Cha Gelado de Pessego', 10.90, 'bebida', 'Cha gelado'),
    ('Cha de Sache', 5.90, 'bebida', 'Cha'),

    -- Cafes e chocolates
    ('Expresso Curto', 6.50, 'bebida', 'Cafe'),
    ('Expresso Longo', 8.50, 'bebida', 'Cafe'),
    ('Expresso com Leite', 9.50, 'bebida', 'Cafe'),
    ('Chocolate Quente Simples', 10.90, 'bebida', 'Chocolate quente'),
    ('Capuccino', 11.90, 'bebida', 'Cafe'),
    ('Chocolate Quente Cremoso', 12.90, 'bebida', 'Chocolate quente'),
    ('Chocolate Cremoso com Chantily', 15.90, 'bebida', 'Chocolate quente'),

    -- Salgados e lanches
    ('Salgado Assado', 10.00, 'comida', 'Salgado'),
    ('Pao de Queijo', 8.00, 'comida', 'Salgado'),
    ('Tapioca Queijo', 12.90, 'comida', 'Tapioca'),
    ('Tapioca Peito de Peru e Queijo', 14.90, 'comida', 'Tapioca'),
    ('Tapioca Ovo Mexido e Queijo', 15.90, 'comida', 'Tapioca'),
    ('Pao na Chapa', 7.90, 'comida', 'Lanche'),
    ('Pao na Chapa com Requeijao', 8.90, 'comida', 'Lanche'),
    ('Pao com Ovo', 11.90, 'comida', 'Lanche'),
    ('Queijo Quente', 13.90, 'comida', 'Lanche'),
    ('Misto Quente Peito de Peru', 16.90, 'comida', 'Lanche'),
    ('Omelete Peito de Peru', 18.90, 'comida', 'Omelete'),
    ('Adicional de Nutella', 5.00, 'comida', 'Adicional'),

    -- Doces e conveniencia
    ('Mentos Pure Fresh', 0.60, 'comida', 'Bala'),
    ('M&M Tubo', 7.00, 'comida', 'Chocolate'),
    ('Doce Patrulha Canina', 15.00, 'comida', 'Doce'),
    ('Doce Futebol', 15.00, 'comida', 'Doce'),
    ('Cata Vento de Bolinhas', 7.00, 'comida', 'Doce'),
    ('Bananinha', 4.00, 'comida', 'Doce')
)
insert into public.products (name, unit_price, category, description, image_url)
select name, unit_price, category, description, ''
from catalog
where not exists (
  select 1
  from public.products as existing
  where lower(existing.name) = lower(catalog.name)
);

-- O item abaixo veio sem preco na lista. Cadastre manualmente quando confirmar:
-- insert into public.products (name, unit_price, category, description, image_url)
-- select 'Tridente', 0.00, 'comida', 'Chiclete', ''
-- where not exists (select 1 from public.products where lower(name) = lower('Tridente'));

notify pgrst, 'reload schema';
