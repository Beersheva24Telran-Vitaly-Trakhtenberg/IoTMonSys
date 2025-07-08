import express from 'express';
import pkg from "@vitaly-yosef/node-smart-logger";
const { createLogger, generateLoggerTraceId, setLoggerContext, clearLoggerContext } = pkg;
import { isAdmin, isOperatorOrAdmin } from '../middleware/authorize.js';
import mongoose from 'mongoose';
import Device from '../models/Device.js';

const router = express.Router();
const logger = createLogger('deviceRoutes', './logs');

/**
 * @swagger
 * components:
 *   schemas:
 *     Device:
 *       type: object
 *       required:
 *         - deviceId
 *         - type
 *       properties:
 *         _id:
 *           type: string
 *           description: MongoDB ID устройства
 *         deviceId:
 *           type: string
 *           description: Уникальный идентификатор устройства
 *         name:
 *           type: string
 *           description: Название устройства
 *         type:
 *           type: string
 *           description: Тип устройства
 *         status:
 *           type: string
 *           enum: [pending, approved, blocked]
 *           description: Статус устройства
 *         lastDataReceived:
 *           type: string
 *           format: date-time
 *           description: Время последнего получения данных
 *         batteryLevel:
 *           type: number
 *           description: Уровень заряда батареи (если применимо)
 *         powerType:
 *           type: string
 *           enum: [battery, external]
 *           description: Тип питания устройства
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Время создания записи
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Время последнего обновления записи
 */

/**
 * @swagger
 * /api/devices:
 *   get:
 *     summary: Получить список всех устройств
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Список устройств
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Device'
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 */
router.get('/', isOperatorOrAdmin, async (req, res) => {
  const traceId = generateLoggerTraceId();
  
  // Устанавливаем контекст логгера
  setLoggerContext({
    traceId,
    service: 'deviceRoutes',
    operation: 'getDevices',
    userId: req.user?.sub
  });
  
  try {
    logger.info('Получение списка устройств');
    
    const devices = await Device.find({});
    
    logger.info(`Найдено ${devices.length} устройств`);
    res.json(devices);
  } catch (error) {
    logger.error(`Ошибка при получении списка устройств: ${error.message}`, { error });
    res.status(500).json({ message: 'Ошибка сервера при получении списка устройств' });
  } finally {
    // Очищаем контекст логгера
    clearLoggerContext();
  }
});

/**
 * @swagger
 * /api/devices/{id}:
 *   get:
 *     summary: Получить устройство по ID
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID устройства
 *     responses:
 *       200:
 *         description: Данные устройства
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       404:
 *         description: Устройство не найдено
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 */
router.get('/:id', isOperatorOrAdmin, async (req, res) => {
  const traceId = generateLoggerTraceId();
  
  // Устанавливаем контекст логгера
  setLoggerContext({
    traceId,
    service: 'deviceRoutes',
    operation: 'getDeviceById',
    userId: req.user?.sub,
    deviceId: req.params.id
  });
  
  try {
    logger.info(`Получение устройства с ID: ${req.params.id}`);
    
    const device = await Device.findOne({ deviceId: req.params.id });
    
    if (!device) {
      logger.warn(`Устройство с ID ${req.params.id} не найдено`);
      return res.status(404).json({ message: 'Устройство не найдено' });
    }
    
    logger.info(`Устройство с ID ${req.params.id} найдено`);
    res.json(device);
  } catch (error) {
    logger.error(`Ошибка при получении устройства: ${error.message}`, { error });
    res.status(500).json({ message: 'Ошибка сервера при получении устройства' });
  } finally {
    // Очищаем контекст логгера
    clearLoggerContext();
  }
});

/**
 * @swagger
 * /api/devices/{id}/approve:
 *   put:
 *     summary: Одобрить устройство
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID устройства
 *     responses:
 *       200:
 *         description: Устройство одобрено
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       404:
 *         description: Устройство не найдено
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 */
router.put('/:id/approve', isAdmin, async (req, res) => {
  const traceId = generateLoggerTraceId();
  
  // Устанавливаем контекст логгера
  setLoggerContext({
    traceId,
    service: 'deviceRoutes',
    operation: 'approveDevice',
    userId: req.user?.sub,
    deviceId: req.params.id
  });
  
  try {
    logger.info(`Одобрение устройства с ID: ${req.params.id}`);
    
    const device = await Device.findOne({ deviceId: req.params.id });
    
    if (!device) {
      logger.warn(`Устройство с ID ${req.params.id} не найдено`);
      return res.status(404).json({ message: 'Устройство не найдено' });
    }
    
    device.status = 'approved';
    await device.save();
    
    logger.info(`Устройство с ID ${req.params.id} успешно одобрено`);
    res.json(device);
  } catch (error) {
    logger.error(`Ошибка при одобрении устройства: ${error.message}`, { error });
    res.status(500).json({ message: 'Ошибка сервера при одобрении устройства' });
  } finally {
    // Очищаем контекст логгера
    clearLoggerContext();
  }
});

/**
 * @swagger
 * /api/devices/{id}/block:
 *   put:
 *     summary: Заблокировать устройство
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID устройства
 *     responses:
 *       200:
 *         description: Устройство заблокировано
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       404:
 *         description: Устройство не найдено
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 */
router.put('/:id/block', isAdmin, async (req, res) => {
  const traceId = generateLoggerTraceId();
  
  // Устанавливаем контекст логгера
  setLoggerContext({
    traceId,
    service: 'deviceRoutes',
    operation: 'blockDevice',
    userId: req.user?.sub,
    deviceId: req.params.id
  });
  
  try {
    logger.info(`Блокировка устройства с ID: ${req.params.id}`);
    
    const device = await Device.findOne({ deviceId: req.params.id });
    
    if (!device) {
      logger.warn(`Устройство с ID ${req.params.id} не найдено`);
      return res.status(404).json({ message: 'Устройство не найдено' });
    }
    
    device.status = 'blocked';
    await device.save();
    
    logger.info(`Устройство с ID ${req.params.id} успешно заблокировано`);
    res.json(device);
  } catch (error) {
    logger.error(`Ошибка при блокировке устройства: ${error.message}`, { error });
    res.status(500).json({ message: 'Ошибка сервера при блокировке устройства' });
  } finally {
    // Очищаем контекст логгера
    clearLoggerContext();
  }
});

/**
 * @swagger
 * /api/devices/{id}:
 *   delete:
 *     summary: Удалить устройство
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID устройства
 *     responses:
 *       200:
 *         description: Устройство удалено
 *       404:
 *         description: Устройство не найдено
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 */
router.delete('/:id', isAdmin, async (req, res) => {
  const traceId = generateLoggerTraceId();
  
  // Устанавливаем контекст логгера
  setLoggerContext({
    traceId,
    service: 'deviceRoutes',
    operation: 'removeDevice',
    userId: req.user?.sub,
    deviceId: req.params.id
  });
  
  try {
    logger.info(`Удаление устройства с ID: ${req.params.id}`);
    
    const device = await Device.findOne({ deviceId: req.params.id });
    
    if (!device) {
      logger.warn(`Устройство с ID ${req.params.id} не найдено`);
      return res.status(404).json({ message: 'Устройство не найдено' });
    }
    
    await Device.deleteOne({ deviceId: req.params.id });
    
    logger.info(`Устройство с ID ${req.params.id} успешно удалено`);
    res.json({ message: 'Устройство успешно удалено' });
  } catch (error) {
    logger.error(`Ошибка при удалении устройства: ${error.message}`, { error });
    res.status(500).json({ message: 'Ошибка сервера при удалении устройства' });
  } finally {
    // Очищаем контекст логгера
    clearLoggerContext();
  }
});

/**
 * @swagger
 * /api/devices/{id}/update:
 *   put:
 *     summary: Обновить информацию об устройстве
 *     tags: [Devices]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID устройства
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Название устройства
 *     responses:
 *       200:
 *         description: Информация об устройстве обновлена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Device'
 *       404:
 *         description: Устройство не найдено
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 */
router.put('/:id/update', isOperatorOrAdmin, async (req, res) => {
  const traceId = generateLoggerTraceId();
  
  // Устанавливаем контекст логгера
  setLoggerContext({
    traceId,
    service: 'deviceRoutes',
    operation: 'updateDevice',
    userId: req.user?.sub,
    deviceId: req.params.id
  });
  
  try {
    logger.info(`Обновление информации об устройстве с ID: ${req.params.id}`);
    
    const device = await Device.findOne({ deviceId: req.params.id });
    
    if (!device) {
      logger.warn(`Устройство с ID ${req.params.id} не найдено`);
      return res.status(404).json({ message: 'Устройство не найдено' });
    }
    
    // Обновляем только разрешенные поля
    if (req.body.name) {
      device.name = req.body.name;
    }
    
    await device.save();
    
    logger.info(`Информация об устройстве с ID ${req.params.id} успешно обновлена`);
    res.json(device);
  } catch (error) {
    logger.error(`Ошибка при обновлении информации об устройстве: ${error.message}`, { error });
    res.status(500).json({ message: 'Ошибка сервера при обновлении информации об устройстве' });
  } finally {
    // Очищаем контекст логгера
    clearLoggerContext();
  }
});

export default router;