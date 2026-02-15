const axios = require('axios');

const API_CONFIG = {
    BASE_URL: 'https://bayi.lisansofisi.com/api',
    API_KEY: 'ak_803b789e6aed8a50f21fb6b6a9bddaa5_1769965145'
};

const testAuthVariations = async () => {
    const methods = [
        { name: 'X-API-KEY header', headers: { 'X-API-KEY': API_CONFIG.API_KEY } },
        { name: 'apikey header', headers: { 'apikey': API_CONFIG.API_KEY } },
        { name: 'api-key header', headers: { 'api-key': API_CONFIG.API_KEY } },
        { name: 'Bearer Token (case sensitive check)', headers: { 'Authorization': `Bearer ${API_CONFIG.API_KEY}` } },
        { name: 'Token header', headers: { 'Token': API_CONFIG.API_KEY } },
        { name: 'X-Auth-Token header', headers: { 'X-Auth-Token': API_CONFIG.API_KEY } }
    ];

    for (const method of methods) {
        try {
            console.log(`Testing: ${method.name}`);
            const response = await axios.get(`${API_CONFIG.BASE_URL}/products`, {
                headers: method.headers,
                timeout: 5000
            });
            console.log(`Success with ${method.name}:`, JSON.stringify(response.data).substring(0, 500));
            return; // Stop if success
        } catch (error) {
            console.log(`Failed ${method.name}:`, error.response ? `${error.response.status} ${error.response.data.error || ''}` : error.message);
        }
    }
};

testAuthVariations();
