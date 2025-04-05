import express from 'express';

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     summary: API root endpoint
 *     description: Returns a welcome message for the API
 *     tags: [Root]
 *     responses:
 *       200:
 *         description: Welcome message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to IoTMonSys API' });
});

export default router;
