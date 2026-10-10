'use strict';

const { dispatchNetlifyEvent } = require('../../api/_lib/hostingApiRouter.cjs');

exports.handler = async (event) => dispatchNetlifyEvent(event);
