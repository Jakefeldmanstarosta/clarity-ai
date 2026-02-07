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
    console.error(`\n[BaseHttpClient] HTTP Error for ${url}:`);

    const errorContext = {
      url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    };

    if (error.response) {
      // Server responded with error status
      console.error(`[BaseHttpClient] Server responded with status ${error.response.status}`);
      console.error(`[BaseHttpClient] Response data:`, error.response.data);
      console.error(`[BaseHttpClient] Response headers:`, error.response.headers);

      const errorMessage = error.response.data?.message ||
                          error.response.data?.error ||
                          error.response.statusText ||
                          'Unknown server error';

      throw new Error(`HTTP ${error.response.status} from ${url}: ${errorMessage}`);
    } else if (error.request) {
      // Request made but no response received
      console.error(`[BaseHttpClient] No response received (timeout or network error)`);
      console.error(`[BaseHttpClient] Request config:`, {
        method: error.config?.method,
        url: error.config?.url,
        timeout: error.config?.timeout
      });

      throw new Error(`No response from ${url} - check network connection or API endpoint`);
    } else {
      // Error in request setup
      console.error(`[BaseHttpClient] Request setup error:`, error.message);
      throw new Error(`Request setup error for ${url}: ${error.message}`);
    }
  }
}
