const express = require('express');
const path = require('path');
const { basicAuth } = require('../middleware/auth');
const apiRouter = require('./api');

const router = express.Router();

router.use(basicAuth);
router.use('/api', apiRouter);
router.use(express.static(path.join(__dirname, '..', '..', 'public')));

module.exports = router;
