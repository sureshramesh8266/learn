const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'https://your-backend-url.com/api';

exports.handler = async (event, context) => {
  const { httpMethod, path, headers, body, queryStringParameters } = event;
  
  // Extract the API path from the Netlify function path
  const apiPath = path.replace('/.netlify/functions/api', '');
  const targetUrl = `${API_BASE_URL}${apiPath}`;
  
  try {
    const config = {
      method: httpMethod,
      url: targetUrl,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      params: queryStringParameters
    };
    
    if (body && httpMethod !== 'GET') {
      config.data = body;
    }
    
    const response = await axios(config);
    
    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    return {
      statusCode: error.response?.status || 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: error.response?.data?.error || error.message 
      })
    };
  }
};