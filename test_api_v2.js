const axios = require('axios');

const API_CONFIG = {
    BASE_URL: 'https://bayi.lisansofisi.com/api',
    API_KEY: 'ak_803b789e6aed8a50f21fb6b6a9bddaa5_1769965145'
};

const testPostFetch = async () => {
    console.log("--- Testing POST /products with API KEY ---");
    try {
        const response = await axios.post(`${API_CONFIG.BASE_URL}/products`, {
            api_key: API_CONFIG.API_KEY
        });
        console.log("POST Success:", JSON.stringify(response.data).substring(0, 500));
    } catch (error) {
        console.log("POST Failed:", error.response ? `${error.response.status} ${JSON.stringify(error.response.data)}` : error.message);
    }

    console.log("--- Testing GET /products with key in query ---");
    try {
        const response = await axios.get(`${API_CONFIG.BASE_URL}/products?api_key=${API_CONFIG.API_KEY}`);
        console.log("GET Query Success:", JSON.stringify(response.data).substring(0, 500));
    } catch (error) {
        console.log("GET Query Failed:", error.response ? `${error.response.status} ${JSON.stringify(error.response.data)}` : error.message);
    }
};

testPostFetch();
