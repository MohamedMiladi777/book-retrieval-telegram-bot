const axios = require("axios");
const MY_TOKEN = "7468734853:AAGKmIbkKkTTRK1-JBDwsRbsfWuzWYZAPYc";
const BASE_URL = `https://api.telegram.org/bot${MY_TOKEN}`;

function getAxiosInstance() {
  return {
    get(method, params) {
      return axios.get(`/${method}`, {
        baseURL: BASE_URL,
        params,
      });
    },
    post(method, data){
        return axios({
            method:"post",
            baseURL: BASE_URL,
            url:`${method}`,
        })
    }
  };
}


module.exports = {axiosInstance: getAxiosInstance()}