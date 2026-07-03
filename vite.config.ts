import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    allowedHosts: ["dumpiest-raymon-prenarial.ngrok-free.dev"],
    proxy: {
      "/socket.io": {
        target: "http://localhost:3000", // port backend của bạn
        ws: true, // bắt buộc cho WebSocket
        changeOrigin: true,
      },
       "/api": {
        target: "http://localhost:3000",
        // changeOrigin: true,
      },
    },
  },
});
