import React from "react";
import { createRoot } from "react-dom/client";
import ReceivingActualForm from "../../../src/receiving/ReceivingActualForm.jsx";

// Let Vite resolve the same dependency URLs as the component under test.
export function mountActualForm(host, onConfirm) {
  createRoot(host).render(React.createElement(ReceivingActualForm, {
    plannedQuantity: 8, unit: "m3", busy: false, onConfirm,
  }));
}
