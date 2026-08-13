import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@pocket/ui/src/theme.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
