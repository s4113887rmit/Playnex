/**
 * memoryUsers.js - In-memory user store for the A2 prototype.
 *
 * The A2 brief does not require permanent storage yet, so the shared User
 * Account module can run entirely on these in-memory users when MongoDB is
 * unreachable. The same module is used by the blog routes for ownership checks.
 */
const bcrypt = require('bcryptjs');

const memoryUsers = [];

function seedMemoryUsers() {
  if (memoryUsers.length) return;

  const demoUsers = [
    { id: 'mem-admin', username: 'admin', name: 'Playnex Admin', email: 'admin@playnex.com', password: 'admin12345', description: 'Playnex site administrator.', role: 'admin' },
    { id: 'mem-john', username: 'john', name: 'John A', email: 'john@example.com', password: 'password123', description: 'Casual gamer and community regular.', role: 'user' }
  ];

  demoUsers.forEach((demo) => {
    memoryUsers.push({
      id: demo.id,
      username: demo.username,
      name: demo.name,
      email: demo.email,
      password: bcrypt.hashSync(demo.password, 12),
      description: demo.description,
      profilePicture: 'uploads/default-profile.svg',
      role: demo.role,
      isLocked: false,
      isActive: true
    });
  });
}

seedMemoryUsers();

function findMemoryUser(predicate) {
  return memoryUsers.find(predicate);
}

function addMemoryUser(user) {
  memoryUsers.push(user);
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    description: u.description,
    profilePicture: u.profilePicture,
    role: u.role,
    isLocked: u.isLocked,
    isActive: u.isActive
  };
}

module.exports = {
  memoryUsers,
  findMemoryUser,
  addMemoryUser,
  publicUser
};
