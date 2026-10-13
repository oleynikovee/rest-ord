import { createHash } from 'node:crypto';
import type { Category, MenuItem } from '../domain/models.js';
import type { MenuData } from '../domain/ports.js';

function stableId(seed: string): string {
  const hex = createHash('sha1').update(seed).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const CATALOG: Record<string, string[]> = {
  Starters: ['Bruschetta', 'Spring Rolls', 'Nachos', 'Calamari', 'Hummus Plate', 'Chicken Wings'],
  Soups: ['Borscht', 'Tom Yum', 'Minestrone', 'Ramen', 'French Onion Soup', 'Gazpacho'],
  Salads: ['Caesar Salad', 'Greek Salad', 'Caprese', 'Cobb Salad', 'Quinoa Bowl', 'Nicoise'],
  Pizza: ['Margherita', 'Pepperoni', 'Quattro Formaggi', 'Diavola', 'Capricciosa', 'Funghi'],
  Pasta: ['Carbonara', 'Bolognese', 'Pesto Genovese', 'Arrabbiata', 'Lasagna', 'Cacio e Pepe'],
  Burgers: ['Classic Burger', 'Cheeseburger', 'BBQ Burger', 'Veggie Burger', 'Chicken Burger', 'Smash Burger'],
  Grill: ['Ribeye Steak', 'Pork Ribs', 'Lamb Chops', 'Chicken Skewers', 'Grilled Halloumi', 'Sausages'],
  Seafood: ['Grilled Salmon', 'Fish & Chips', 'Shrimp Scampi', 'Mussels', 'Seared Tuna', 'Octopus'],
  Sushi: ['California Roll', 'Philadelphia Roll', 'Salmon Nigiri', 'Dragon Roll', 'Tuna Maki', 'Ebi Tempura Roll'],
  Desserts: ['Tiramisu', 'Cheesecake', 'Panna Cotta', 'Brownie', 'Creme Brulee', 'Apple Strudel'],
  Drinks: ['Lemonade', 'Iced Tea', 'Cola', 'Orange Juice', 'Mineral Water', 'Ginger Ale'],
  'Coffee & Tea': ['Espresso', 'Cappuccino', 'Flat White', 'Latte', 'Green Tea', 'Masala Chai'],
};

const VARIANTS = [
  'Classic', 'House', 'Spicy', 'Truffle', 'Smoked', 'Chef’s', 'Mini', 'Large',
  'Vegan', 'Double', 'Garden', 'Signature', 'Rustic', 'Crispy',
];

const OPEN_PRICE_ITEMS: Record<string, string> = {
  Seafood: 'Catch of the Day',
  Grill: 'Steak by Weight',
  Desserts: 'Birthday Cake (custom)',
  Drinks: 'Wine by the Bottle',
};

export function generateSeedMenu(): MenuData {
  const categories: Category[] = [];
  const items: MenuItem[] = [];
  let n = 0;

  Object.entries(CATALOG).forEach(([categoryName, dishes], categoryIndex) => {
    const categoryId = stableId(`category:${categoryName}`);
    categories.push({ id: categoryId, name: categoryName, sortOrder: categoryIndex, version: 1 });

    const openPrice = OPEN_PRICE_ITEMS[categoryName];
    if (openPrice) {
      items.push({
        id: stableId(`item:${categoryName}:open`),
        categoryId,
        name: openPrice,
        description: 'Price is agreed with the guest when ordering.',
        price: null,
        available: true,
        openPrice: true,
        version: 1,
      });
    }

    for (const dish of dishes) {
      for (const variant of VARIANTS) {
        n++;
        const base = 300 + ((n * 7919) % 2700);
        items.push({
          id: stableId(`item:${categoryName}:${dish}:${variant}`),
          categoryId,
          name: `${variant} ${dish}`,
          description: `${variant} take on our ${dish.toLowerCase()}.`,
          price: Math.round(base / 10) * 10 - 1,
          available: n % 17 !== 0,
          openPrice: false,
          version: 1,
        });
      }
    }
  });

  return { categories, items };
}
