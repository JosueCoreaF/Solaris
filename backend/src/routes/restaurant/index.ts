import express from 'express'
import { syncContext } from '../../controllers/restaurant/context.controller.js'

const router = express.Router()

router.get('/sync-context', syncContext)
router.get('/', (_req, res) => {
  res.json({ module: 'restaurant', message: 'Restaurant API placeholder' })
})

export default router
