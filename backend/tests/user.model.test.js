const User = require('../src/models/User');

describe('User Model', () => {
  describe('Validation', () => {
    it('should create a valid user', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
        role: 'viewer',
      };

      const user = await User.create(userData);

      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.password).not.toBe(userData.password); // Should be hashed
    });

    it('should fail without required name', async () => {
      const userData = {
        email: 'john@example.com',
        password: 'Password123',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail without required email', async () => {
      const userData = {
        name: 'John Doe',
        password: 'Password123',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail without required password', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail with invalid email format', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'Password123',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail with password less than 8 characters', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Pass123',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should fail with duplicate email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      };

      await User.create(userData);
      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should default role to viewer', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      };

      const user = await User.create(userData);
      expect(user.role).toBe('viewer');
    });

    it('should accept valid roles', async () => {
      const roles = ['viewer', 'editor', 'admin'];

      for (const role of roles) {
        const user = await User.create({
          name: 'Test User',
          email: `test-${role}@example.com`,
          password: 'Password123',
          role,
        });
        expect(user.role).toBe(role);
      }
    });

    it('should fail with invalid role', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
        role: 'superuser',
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should lowercase email', async () => {
      const userData = {
        name: 'John Doe',
        email: 'John@Example.COM',
        password: 'Password123',
      };

      const user = await User.create(userData);
      expect(user.email).toBe('john@example.com');
    });
  });

  describe('Password Hashing', () => {
    it('should hash password before saving', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      };

      const user = await User.create(userData);
      expect(user.password).not.toBe(userData.password);
      expect(user.password).toMatch(/^\$2[aby]\$.{56}$/); // bcrypt hash pattern
    });

    it('should not rehash password if not modified', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      });

      const originalHash = user.password;
      user.name = 'Jane Doe';
      await user.save();

      const updatedUser = await User.findById(user._id).select('+password');
      expect(updatedUser.password).toBe(originalHash);
    });
  });

  describe('Methods', () => {
    it('should compare password correctly', async () => {
      const password = 'Password123';
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password,
      });

      const userWithPassword = await User.findById(user._id).select('+password');
      const isMatch = await userWithPassword.comparePassword(password);
      expect(isMatch).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      });

      const userWithPassword = await User.findById(user._id).select('+password');
      const isMatch = await userWithPassword.comparePassword('WrongPassword');
      expect(isMatch).toBe(false);
    });

    it('should find user by email', async () => {
      await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      });

      const user = await User.findByEmail('john@example.com');
      expect(user).not.toBeNull();
      expect(user.email).toBe('john@example.com');
    });

    it('should return null for non-existent email', async () => {
      const user = await User.findByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    it('should not include password in toJSON', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      });

      const json = user.toJSON();
      expect(json.password).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });
});
