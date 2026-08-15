import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Seeding initial SUPERADMIN account...');

  let connectionString = process.env.DATABASE_URL;
  if (connectionString && connectionString.startsWith('prisma+postgres://')) {
    connectionString = 'postgres://postgres:postgres@localhost:51214/template1';
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const superadminEmail = 'superadmin@orchestrix.com';
    
    // Check if superadmin already exists
    const existing = await prisma.user.findFirst({
      where: { role: 'SUPERADMIN' },
    });

    if (existing) {
      console.log(`SUPERADMIN account already exists: "${existing.email}"`);
      return;
    }

    const passwordHash = await bcrypt.hash('orchestrixadmin123!', 10);

    const user = await prisma.user.create({
      data: {
        email: superadminEmail,
        passwordHash,
        role: 'SUPERADMIN',
        tenantId: null, // Global user bypasses tenancy restrictions
      },
    });

    console.log(`Successfully created SUPERADMIN account:`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Role: ${user.role}`);
    console.log(`- Password: orchestrixadmin123! (Change this on first login)`);
  } catch (err) {
    console.error('Error seeding superadmin:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
