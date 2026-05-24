import express from 'express'
import { syncContext } from '../../controllers/gym/context.controller.js'

const router = express.Router()

router.get('/sync-context', syncContext)
router.get('/', (_req, res) => {
  res.json({ module: 'gym', message: 'Gym API placeholder' })
})

export default router
