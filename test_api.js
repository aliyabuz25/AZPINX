const axios = require('axios');

const API_CONFIG = {
    BASE_URL: 'https://bayi.lisansofisi.com/api',
    API_KEY: 'ak_803b789e6aed8a50f21fb6b6a9bddaa5_1769965145'
};

const troubleshootAPI = async () => {
    console.log("--- API Troubleshooting Start ---");

    // Test 1: Generic GET to base URL or /products/all if common
    const endpoints = ['', '/products', '/v1/products', '/v2/products', '/services', '/categories'];

    for (const endpoint of endpoints) {
        try {
            console.log(`Testing endpoint: ${API_CONFIG.BASE_URL}${endpoint}`);
            const response = await axios.get(`${API_CONFIG.BASE_URL}${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                    'Accept': 'application/json',
                    'apikey': API_CONFIG.API_KEY // Sometimes used instead of Bearer
                },
                timeout: 5000
            });
            console.log(`Success [${endpoint}]:`, JSON.stringify(response.data).substring(0, 200));
        } catch (error) {
            console.log(`Failed [${endpoint}]:`, error.response ? `${error.response.status} ${error.response.statusText}` : error.message);
        }
    }

    console.log("--- API Troubleshooting End ---");
};

troubleshootAPI();
