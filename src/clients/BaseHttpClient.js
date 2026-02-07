import axios from 'axios';
import https from 'https';

export class BaseHttpClient {
  constructor(config) {
    this.config = config;

    const httpsAgent = new https.Agent({
      keepAlive: true,
      rejectUnauthorized: !config.server.allowInsecureHttps
    });

    this.axiosInstance = axios.create({
      httpsAgent,
      timeout: 30000 // 30 second timeout
    });
  }

  async post(url, data, options = {}) {
    try {
      const response = await this.axiosInstance.post(url, data, options);
      return response.data;
    } catch (error) {
      this._handleError(error, url);
    }
  }

  async get(url, options = {}) {
    try {
      const response = await this.axiosInstance.get(url, options);
      return response.data;
    } catch (error) {
      this._handleError(error, url);
    }
  }

  _handleError(error, url) {
    const errorContext = {
      url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    };

    if (error.response) {
      // Server responded with error status
      throw new Error(`HTTP ${error.response.status}: ${JSON.stringify(errorContext)}`);
    } else if (error.request) {
      // Request made but no response received
      throw new Error(`No response received from ${url}: ${error.message}`);
    } else {
      // Error in request setup
      throw new Error(`Request setup error for ${url}: ${error.message}`);
    }
  }
}
