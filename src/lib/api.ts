import axios from "axios";

const baseAPI = axios.create({
  // baseURL: "http://localhost:5000",
  baseURL: "https://ultron-backend-qoe2.onrender.com",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export default baseAPI;