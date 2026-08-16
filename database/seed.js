// Seeds initial data: admin account, categories, menu items (estimated prices),
// delivery zones, and restaurant settings. Safe to re-run (skips existing rows).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const categories = [
  { name: 'Rice & Grains', slug: 'rice-grains', order: 1 },
  { name: 'Swallow', slug: 'swallow', order: 2 },
  { name: 'Soups & Sides', slug: 'soups-sides', order: 3 },
  { name: 'Proteins', slug: 'proteins', order: 4 },
  { name: 'Premium Meats', slug: 'premium-meats', order: 5 },
  { name: 'Combos', slug: 'combos', order: 6 },
  { name: 'Specials', slug: 'specials', order: 7 },
  { name: 'Beverages', slug: 'beverages', order: 8 },
];

const menuItems = [
  // Rice & Grains
  { cat: 'rice-grains', name: 'Jollof Rice', price: 1500, desc: 'Smoky party-style jollof rice cooked in rich pepper sauce.', portion: 'Per portion', featured: true },
  { cat: 'rice-grains', name: 'Fried Rice', price: 1500, desc: 'Savoury fried rice with mixed vegetables.', portion: 'Per portion' },
  { cat: 'rice-grains', name: 'Basmati Rice', price: 1500, desc: 'Fragrant long-grain basmati rice.', portion: 'Per portion' },
  { cat: 'rice-grains', name: 'Native Rice & Beef', price: 2500, desc: 'Steamed native rice made with traditional local oils and spices, served with beef.', portion: 'Per portion', featured: true },
  // Swallow
  { cat: 'swallow', name: 'Amala (Plain Portion)', price: 1200, desc: 'Smooth-textured amala swallow, served without protein.', portion: 'Per portion' },
  { cat: 'swallow', name: 'Iyan (Pounded Yam)', price: 1000, desc: 'Soft, stretchy pounded yam.', portion: 'Per portion' },
  { cat: 'swallow', name: 'Semo', price: 800, desc: 'Smooth semovita swallow.', portion: 'Per portion' },
  // Soups & Sides
  { cat: 'soups-sides', name: 'Egusi Soup', price: 1000, desc: 'Rich melon-seed soup with assorted vegetables.', portion: 'Per portion' },
  { cat: 'soups-sides', name: 'Ewedu + Gbegiri', price: 1000, desc: 'Classic abula pairing of ewedu and gbegiri.', portion: 'Per portion' },
  { cat: 'soups-sides', name: 'Vegetable Soup', price: 1000, desc: 'Fresh leafy vegetable soup.', portion: 'Per portion' },
  { cat: 'soups-sides', name: 'Ogbono Soup', price: 1000, desc: 'Draw soup made from ground ogbono seeds.', portion: 'Per portion' },
  { cat: 'soups-sides', name: 'Moi-Moi', price: 1000, desc: 'Steamed blended beans, peppers and savoury spices.', portion: 'Per wrap' },
  // Proteins
  { cat: 'proteins', name: 'Fried Fish', price: 2600, desc: 'Crispy seasoned fried fish.', portion: 'Per piece' },
  { cat: 'proteins', name: 'Beef', price: 2600, desc: 'Tender, well-seasoned beef.', portion: 'Per piece' },
  { cat: 'proteins', name: 'Peppered Cowhead (Ponmo)', price: 2700, desc: 'Spicy peppered cowhead.', portion: 'Per piece' },
  // Premium Meats
  { cat: 'premium-meats', name: 'Chicken', price: 3999, desc: 'Large piece of well-seasoned chicken.', portion: 'Per piece' },
  { cat: 'premium-meats', name: 'Fried Turkey', price: 3999, desc: 'Crispy fried turkey.', portion: 'Per piece' },
  { cat: 'premium-meats', name: 'Peppered Chicken', price: 3999, desc: 'Chicken tossed in spicy pepper sauce.', portion: 'Per piece' },
  // Combos
  { cat: 'combos', name: 'Swallow Combo + Beef', price: 2400, desc: 'Amala, iyan or semo with soup and beef pieces.', portion: 'Combo', featured: true },
  { cat: 'combos', name: 'Swallow Combo + Goat Meat', price: 4200, desc: 'Amala, iyan or semo with soup and standard goat meat.', portion: 'Combo' },
  { cat: 'combos', name: 'Swallow Combo + Goat Lap', price: 4000, desc: 'Premium larger cut of goat meat served with a swallow combo.', portion: 'Combo' },
  { cat: 'combos', name: 'Swallow Combo + Chicken', price: 4400, desc: 'Amala, iyan or semo with soup and a large piece of chicken.', portion: 'Combo' },
  { cat: 'combos', name: 'Special Combo Deal (2pc Chicken + Jollof/Swallow)', price: 3400, desc: '2 pieces of chicken paired with jollof rice or swallow.', portion: 'Combo', featured: true },
  // Specials
  { cat: 'specials', name: 'Gizdodo Rice Combo', price: 3000, desc: 'Signature dish: seasoned rice tossed with spiced gizzards and fried plantains.', portion: 'Per plate', featured: true },
  { cat: 'specials', name: 'Jollof Spaghetti', price: 1500, desc: 'Spaghetti cooked jollof-style in pepper sauce.', portion: 'Per portion' },
  // Beverages
  { cat: 'beverages', name: 'Chilled Zobo / Zunu Zaki', price: 1500, desc: 'Traditional Nigerian hibiscus drink, lightly sweetened and chilled.', portion: 'Per bottle' },
  { cat: 'beverages', name: 'Lucozade Boost (Pet Bottle)', price: 1800, desc: 'Energy drink, pet bottle.', portion: 'Per bottle' },
  { cat: 'beverages', name: 'Monster Energy Drink', price: 1200, desc: 'Energy drink, can.', portion: 'Per can' },
  { cat: 'beverages', name: 'Malt', price: 800, desc: 'Chilled malt drink, can.', portion: 'Per can' },
];

const deliveryZones = [
  { name: 'Local / Immediate Zone', areas: 'Broadcasting Road, Tunga, Mobil, Shiroro Road Axis', fee: 1000 },
  { name: 'Standard Neighbouring Zone', areas: 'Bosso, Kpakungu, Chanchaga, Bahago, Barkin Sale', fee: 1500 },
  { name: 'Extended / Inter-Zone', areas: 'FUT Minna Gidan Kwano Campus, Maikunkele, Airport Road, Government House Area, GRA', fee: 2000 },
];

const settings = {
  restaurant_name: 'Iya Femi Restaurant',
  tagline: 'Authentic Nigerian cuisine in the heart of Minna',
  description: 'Iya Femi Restaurant serves affordable, generous portions of traditional Nigerian dishes — amala, pounded yam, jollof rice, egusi and more — from Broadcasting Road, Minna South.',
  address: '23 Broadcasting Road, Minna South, Minna 920101, Niger State, Nigeria',
  phone_primary: '+234 806 524 9697',
  phone_secondary: '+234 816 161 6761',
  phone_tertiary: '+234 802 588 3613',
  whatsapp_number: '+2348065249697',
  email: '',
  maps_query: 'Iya Femi Restaurant, Broadcasting Road, Minna, Nigeria',
  opening_hours: JSON.stringify({
    monday: { open: '08:00', close: '21:00', closed: false },
    tuesday: { open: '08:00', close: '21:00', closed: false },
    wednesday: { open: '08:00', close: '21:00', closed: false },
    thursday: { open: '08:00', close: '21:00', closed: false },
    friday: { open: '08:00', close: '21:00', closed: false },
    saturday: { open: '08:00', close: '21:00', closed: false },
    sunday: { open: '08:00', close: '21:00', closed: true },
  }),
  ordering_enabled: 'true',
  minimum_order: '1000',
  // Bank details are placeholders — update them from Admin → Settings.
  bank_name: '[Bank Name Placeholder]',
  bank_account_name: '[Account Name Placeholder]',
  bank_account_number: '[Account Number Placeholder]',
  facebook_url: '',
  instagram_url: '',
  tiktok_url: '',
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const email = process.env.ADMIN_EMAIL || 'admin@iyafemi.local';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const name = process.env.ADMIN_NAME || 'Restaurant Admin';
    const hash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO admins (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'owner') ON CONFLICT (email) DO NOTHING`,
      [name, email, hash]
    );

    for (const c of categories) {
      await client.query(
        `INSERT INTO categories (name, slug, display_order) VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO NOTHING`,
        [c.name, c.slug, c.order]
      );
    }

    const { rows: catRows } = await client.query('SELECT id, slug FROM categories');
    const catBySlug = Object.fromEntries(catRows.map((r) => [r.slug, r.id]));

    for (const item of menuItems) {
      const { rows } = await client.query('SELECT 1 FROM menu_items WHERE name = $1', [item.name]);
      if (rows.length) continue;
      await client.query(
        `INSERT INTO menu_items (category_id, name, description, portion_info, price, featured)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [catBySlug[item.cat], item.name, item.desc, item.portion, item.price, !!item.featured]
      );
    }

    const { rows: zoneCount } = await client.query('SELECT COUNT(*)::int AS n FROM delivery_zones');
    if (zoneCount[0].n === 0) {
      for (const z of deliveryZones) {
        await client.query('INSERT INTO delivery_zones (name, areas, fee) VALUES ($1, $2, $3)', [z.name, z.areas, z.fee]);
      }
    }

    for (const [key, value] of Object.entries(settings)) {
      await client.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [key, value]
      );
    }

    await client.query('COMMIT');
    console.log('Seed complete. Admin login:', email);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
