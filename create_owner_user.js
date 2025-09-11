require('dotenv').config();
const readline = require('readline');
const jwt = require('jsonwebtoken');
const { sequelize } = require('./config/database');
const Owner = require('./models/owner.model');

async function main() {
  try {
    await sequelize.authenticate();
    await Owner.sync(); // ensure table exists

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(res => rl.question(q, ans => res(ans)));

    const email = (await ask('Owner email: ')).trim().toLowerCase();
    const password = (await ask('Owner password (min 12 chars): ')).trim();
    rl.close();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error('Invalid email');
    }
    if (!password || password.length < 12) {
      throw new Error('Password too short (min 12)');
    }

    const existing = await Owner.findOne({ where: { email } });
    if (existing) {
      throw new Error('Owner with this email already exists');
    }

    const owner = await Owner.create({ email, password });
    console.log('✔ Owner created with id:', owner.id);

    // Generate an owner token for initial access if desired
    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not set; cannot generate token');
      process.exit(0);
    }
    const token = jwt.sign({ id: owner.id, type: 'owner' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('Use this temporary OWNER token (Authorization: Bearer <token>) to call /api/owner endpoints for setup:');
    console.log(token);
  } catch (err) {
    console.error('Failed to create owner:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();

