const axios = require('axios');

const API_CONFIG = {
    BASE_URL: 'https://bayi.lisansofisi.com/api',
    API_KEY: 'ak_803b789e6aed8a50f21fb6b6a9bddaa5_1769965145'
};

const verifyAPI = async () => {
    console.log("--- Verified API Test Start ---");

    // Test status (no auth required)
    try {
        console.log("Testing status...");
        const statusRes = await axios.get(`${API_CONFIG.BASE_URL}/status`);
        console.log("Status Success:", statusRes.data);
    } catch (e) {
        console.log("Status Failed:", e.message);
    }

    // Test products (with X-API-Key)
    try {
        console.log("Testing products list...");
        const productsRes = await axios.get(`${API_CONFIG.BASE_URL}/products`, {
            headers: { 'X-API-Key': API_CONFIG.API_KEY }
        });
        console.log("Products Success! Count:", productsRes.data.data.products.length);
        console.log("First product sample:", JSON.stringify(productsRes.data.data.products[0], null, 2));
    } catch (e) {
        console.log("Products Failed:", e.response ? `${e.response.status} ${JSON.stringify(e.response.data)}` : e.message);
    }

    console.log("--- Verified API Test End ---");
};

verifyAPI();
