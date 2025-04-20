import User from './User.js';
import Permission from './Permission.js';
import RolePermission from './RolePermission.js';
import UserSession from './UserSession.js';
import sequelize from '../../config/sequelize.js';
import { createLogger } from "@iotmonsys/logger-node";

let logger = createLogger('backend', './logs');

export const syncDatabase = async (force = false) => {
  try {
    await sequelize.sync({ force });
    logger.info('Database synchronized successfully');
    return true;
  } catch (error) {
    logger.alert('Error synchronizing database:', error);
    return false;
  }
};

export const initializePermissions = async () => {
  const defaultPermissions = [
    { name: 'user:read', description: 'Can read user data' },
    { name: 'user:write', description: 'Can create and update user data' },
    { name: 'user:delete', description: 'Can delete users' },
    { name: 'device:read', description: 'Can read device data' },
    { name: 'device:write', description: 'Can create and update devices' },
    { name: 'device:delete', description: 'Can delete devices' },
    { name: 'alert:read', description: 'Can read alerts' },
    { name: 'alert:write', description: 'Can create and update alerts' },
    { name: 'alert:delete', description: 'Can delete alerts' },
    { name: 'system:read', description: 'Can read system settings' },
    { name: 'system:write', description: 'Can update system settings' }
  ];

  try {
    for (const perm of defaultPermissions) {
      await Permission.findOrCreate({
        where: { name: perm.name },
        defaults: perm
      });
    }
    console.log('Default permissions initialized');

    const rolePermissions = [
      ...defaultPermissions.map(p => ({ role: 'admin', permissionName: p.name })),

      { role: 'operator', permissionName: 'device:read' },
      { role: 'operator', permissionName: 'device:write' },
      { role: 'operator', permissionName: 'alert:read' },
      { role: 'operator', permissionName: 'alert:write' },

      { role: 'user', permissionName: 'device:read' },
      { role: 'user', permissionName: 'alert:read' }
    ];

    for (const rp of rolePermissions) {
      const permission = await Permission.findOne({ where: { name: rp.permissionName } });
      if (permission) {
        await RolePermission.findOrCreate({
          where: {
            role: rp.role,
            permissionId: permission.id
          },
          defaults: {
            role: rp.role,
            permissionId: permission.id
          }
        });
      }
    }
    logger.info('Role permissions initialized');

    return true;
  } catch (error) {
    logger.error('Error initializing permissions:', error);
    return false;
  }
};

export const createDefaultAdmin = async () => {
  try {
    const [admin, created] = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        email: 'admin@iotmonsys.com',
        password: 'admin123', // Will be hashed via the huck beforeCreate
        role: 'admin',
        firstName: 'Admin',
        lastName: 'User'
      }
    });

    if (created) {
      console.log('Default admin user created');
    } else {
      console.log('Default admin user already exists');
    }

    return true;
  } catch (error) {
    console.error('Error creating default admin:', error);
    return false;
  }
};

export { User, Permission, RolePermission, UserSession };
export default { User, Permission, RolePermission, UserSession };