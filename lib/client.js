require('dotenv').config();
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.SNOW_INSTANCE,
  auth: {
    username: process.env.SNOW_USER,
    password: process.env.SNOW_PASSWORD
  },
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

client.interceptors.request.use(req => {
  if (process.env.DEBUG) {
    console.log(`  --> ${req.method.toUpperCase()} ${req.baseURL}${req.url}`);
  }
  return req;
});

client.interceptors.response.use(
  res => res,
  err => {
    const detail = err.response?.data?.error?.detail || err.message;
    const status = err.response?.status;
    return Promise.reject(new Error(`HTTP ${status}: ${detail}`));
  }
);

module.exports = client;
