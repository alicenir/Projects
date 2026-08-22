import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "rgb(28 28 38)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.08)",
        },
      }}
    />
  </React.StrictMode>
);
