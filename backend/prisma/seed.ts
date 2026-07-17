import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await hash('admin123', { saltLength: 16 });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@beanbrew.com' },
    update: {},
    create: {
      email: 'admin@beanbrew.com',
      passwordHash: adminPassword,
      role: 'SUPER_ADMIN',
      profile: {
        create: {
          firstName: 'System',
          lastName: 'Administrator',
          phone: '+1234567890',
        },
      },
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Create manager user
  const managerPassword = await hash('manager123', { saltLength: 16 });
  const manager = await prisma.user.upsert({
    where: { email: 'manager@beanbrew.com' },
    update: {},
    create: {
      email: 'manager@beanbrew.com',
      passwordHash: managerPassword,
      role: 'MANAGER',
      profile: {
        create: {
          firstName: 'John',
          lastName: 'Manager',
          phone: '+1234567891',
        },
      },
    },
  });
  console.log('✅ Created manager user:', manager.email);

  // Create barista user
  const baristaPassword = await hash('barista123', { saltLength: 16 });
  const barista = await prisma.user.upsert({
    where: { email: 'barista@beanbrew.com' },
    update: {},
    create: {
      email: 'barista@beanbrew.com',
      passwordHash: baristaPassword,
      role: 'BARISTA',
      profile: {
        create: {
          firstName: 'Jane',
          lastName: 'Barista',
          phone: '+1234567892',
        },
      },
    },
  });
  console.log('✅ Created barista user:', barista.email);

  // Create test customer
  const customerPassword = await hash('customer123', { saltLength: 16 });
  const customer = await prisma.user.upsert({
    where: { email: 'customer@beanbrew.com' },
    update: {},
    create: {
      email: 'customer@beanbrew.com',
      passwordHash: customerPassword,
      role: 'CUSTOMER',
      profile: {
        create: {
          firstName: 'Test',
          lastName: 'Customer',
          phone: '+1234567893',
        },
      },
    },
  });
  console.log('✅ Created customer user:', customer.email);

  // Create branch
  const branch = await prisma.branch.upsert({
    where: { id: '550e8400-e29b-41d4-a716-446655440000' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Bean & Brew Downtown',
      address: '123 Coffee Street, Downtown',
      phone: '+14155551234',
      email: 'downtown@beanbrew.com',
      timezone: 'America/Los_Angeles',
      currency: 'USD',
      isActive: true,
    },
  });
  console.log('✅ Created branch:', branch.name);

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { id: 'cat-coffees' },
      update: {},
      create: {
        id: 'cat-coffees',
        name: 'Coffee',
        slug: 'coffee',
        description: 'Premium coffee drinks',
        sortOrder: 1,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { id: 'cat-teas' },
      update: {},
      create: {
        id: 'cat-teas',
        name: 'Tea',
        slug: 'tea',
        description: 'Artisan tea selection',
        sortOrder: 2,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { id: 'cat-pastries' },
      update: {},
      create: {
        id: 'cat-pastries',
        name: 'Pastries',
        slug: 'pastries',
        description: 'Fresh baked goods',
        sortOrder: 3,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { id: 'cat-snacks' },
      update: {},
      create: {
        id: 'cat-snacks',
        name: 'Snacks',
        slug: 'snacks',
        description: 'Light bites and sandwiches',
        sortOrder: 4,
        isActive: true,
      },
    }),
  ]);
  console.log('✅ Created', categories.length, 'categories');

  // Create products
  const products = [
    // Coffee
    { name: 'Espresso', slug: 'espresso', categoryId: 'cat-coffees', basePrice: 3.50, description: 'Rich, bold espresso shot', preparationTime: 2, imageUrl: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400' },
    { name: 'Americano', slug: 'americano', categoryId: 'cat-coffees', basePrice: 4.00, description: 'Espresso with hot water', preparationTime: 3, imageUrl: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=400' },
    { name: 'Cappuccino', slug: 'cappuccino', categoryId: 'cat-coffees', basePrice: 5.00, description: 'Espresso with steamed milk foam', preparationTime: 4, imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400' },
    { name: 'Latte', slug: 'latte', categoryId: 'cat-coffees', basePrice: 5.50, description: 'Espresso with velvety steamed milk', preparationTime: 4, imageUrl: 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=400' },
    { name: 'Mocha', slug: 'mocha', categoryId: 'cat-coffees', basePrice: 6.00, description: 'Espresso with chocolate and steamed milk', preparationTime: 5, imageUrl: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=400' },
    { name: 'Cold Brew', slug: 'cold-brew', categoryId: 'cat-coffees', basePrice: 5.00, description: 'Smooth, cold-steeped coffee', preparationTime: 2, imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400' },
    // Tea
    { name: 'Earl Grey', slug: 'earl-grey', categoryId: 'cat-teas', basePrice: 3.50, description: 'Classic bergamot-infused black tea', preparationTime: 3, imageUrl: 'https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=400' },
    { name: 'Green Tea', slug: 'green-tea', categoryId: 'cat-teas', basePrice: 3.50, description: 'Fresh Japanese green tea', preparationTime: 3, imageUrl: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400' },
    { name: 'Chai Latte', slug: 'chai-latte', categoryId: 'cat-teas', basePrice: 5.00, description: 'Spiced tea with steamed milk', preparationTime: 4, imageUrl: 'https://images.unsplash.com/photo-1578899952107-9c390f1af0a1?w=400' },
    // Pastries
    { name: 'Croissant', slug: 'croissant', categoryId: 'cat-pastries', basePrice: 4.00, description: 'Buttery, flaky French pastry', preparationTime: 1, imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f40388085?w=400' },
    { name: 'Blueberry Muffin', slug: 'blueberry-muffin', categoryId: 'cat-pastries', basePrice: 3.50, description: 'Fresh baked muffin with blueberries', preparationTime: 1, imageUrl: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400' },
    { name: 'Chocolate Cake', slug: 'chocolate-cake', categoryId: 'cat-pastries', basePrice: 6.00, description: 'Rich chocolate layer cake', preparationTime: 2, imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400' },
    // Snacks
    { name: 'Avocado Toast', slug: 'avocado-toast', categoryId: 'cat-snacks', basePrice: 8.00, description: 'Sourdough with fresh avocado', preparationTime: 5, imageUrl: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400' },
    { name: 'Caesar Salad', slug: 'caesar-salad', categoryId: 'cat-snacks', basePrice: 10.00, description: 'Romaine lettuce with Caesar dressing', preparationTime: 5, imageUrl: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400' },
  ];

  for (const product of products) {
    await prisma.product.create({
      data: {
        ...product,
        branchId: branch.id,
        isActive: true,
        attributes: {},
      },
    });
  }
  console.log('✅ Created', products.length, 'products');

  // Create inventory items
  const inventoryItems = [
    { name: 'Coffee Beans (Arabica)', unit: 'KILOGRAM', quantity: 50, threshold: 10 },
    { name: 'Milk (Whole)', unit: 'LITER', quantity: 100, threshold: 20 },
    { name: 'Sugar (White)', unit: 'KILOGRAM', quantity: 30, threshold: 5 },
    { name: 'Paper Cups (12oz)', unit: 'PIECE', quantity: 500, threshold: 100 },
    { name: 'Paper Cups (8oz)', unit: 'PIECE', quantity: 300, threshold: 75 },
    { name: 'Napkins', unit: 'PIECE', quantity: 1000, threshold: 200 },
  ];

  for (const item of inventoryItems) {
    await prisma.inventory.create({
      data: {
        id: `inv-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        branchId: branch.id,
        itemName: item.name,
        unit: item.unit as any,
        quantity: item.quantity,
        threshold: item.threshold,
        status: 'IN_STOCK',
      },
    });
  }
  console.log('✅ Created', inventoryItems.length, 'inventory items');

  console.log('\n🎉 Database seeded successfully!\n');
  console.log('Test accounts:');
  console.log('  Admin:    admin@beanbrew.com / admin123');
  console.log('  Manager:  manager@beanbrew.com / manager123');
  console.log('  Barista:  barista@beanbrew.com / barista123');
  console.log('  Customer: customer@beanbrew.com / customer123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
