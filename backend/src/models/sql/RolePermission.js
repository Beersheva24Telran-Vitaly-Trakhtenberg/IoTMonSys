import { DataTypes } from 'sequelize';
import sequelize from '../../config/sequelize.js';
import Permission from './Permission.js';

const RolePermission = sequelize.define('RolePermission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  role: {
    type: DataTypes.ENUM('admin', 'operator', 'user'),  // Note: no DRY
    allowNull: false
  },
  permissionId: {
    type: DataTypes.UUID,
    references: {
      model: Permission,
      key: 'id'
    }
  }
}, {
  timestamps: true
});

Permission.hasMany(RolePermission);
RolePermission.belongsTo(Permission); // Note ?

export default RolePermission;