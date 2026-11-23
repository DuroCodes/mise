import { createRoot } from "react-dom/client";
import { Demos } from "./demos";
import { startThemes } from "./theme";

/** copy buttons sit next to the command they copy. */
const startCopyButtons = () => {
  document.addEventListener("click", (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("[data-copy]")
        : null;
    const text = button?.parentElement?.querySelector("code")?.textContent;
    if (!button || !text) return;
    void navigator.clipboard.writeText(text).then(
      () => {
        button.textContent = "Copied";
        window.setTimeout(() => {
          button.textContent = "Copy";
        }, 2000);
      },
      () => {
        button.textContent = "Select the text to copy";
      }
    );
  });
};

startThemes();
startCopyButtons();

const islands = document.getElementById("islands");
if (islands) createRoot(islands).render(<Demos />);
