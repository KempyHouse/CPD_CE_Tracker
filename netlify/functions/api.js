'use strict';
/**
 * netlify/functions/api.js
 *
 * Wraps the Express app as a single Netlify Function that handles all /api/* requests.
 * The netlify.toml redirect sends /api/* → /.netlify/functions/api while preserving
 * the original path in event.rawPath so that Express routing still works.
 */
const serverless = require('serverless-http');
const app = require('../../app');

const wrappedHandler = serverless(app);

exports.handler = async (event, context) => {
  // Netlify Functions (v2 runtime) provide rawPath with the original URL.
  // Restore it so serverless-http passes the right path to Express.
  if (event.rawPath) {
    event.path = event.rawPath;
  }
  if (event.rawQueryString && !event.queryStringParameters) {
    try {
      event.queryStringParameters = Object.fromEntries(
        new URLSearchParams(event.rawQueryString)
      );
    } catch { /* ignore */ }
  }
  return wrappedHandler(event, context);
};
