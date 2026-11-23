import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MemoryRouter } from "react-router";
import { mergeInto, weekList } from "../demo-data";
import { PantryDemo } from "./pantry";
import { PlanDemo } from "./plan";
import { CookDemo, RecipeDemo } from "./recipe";
import { ShoppingDemo } from "./shopping";
import { DemoTimers } from "./timers";

/** renders a demo into the slot the page left for it. */
function Slot({ id, children }: { id: string; children: ReactNode }) {
  const slot = document.getElementById(id);
  return slot ? createPortal(children, slot) : null;
}

/**
 * the page's text is plain html; only the demos are react. they share one
 * tree so a timer started in one keeps counting while you read another, and
 * the pantry can add to the shopping list.
 */
function Demos() {
  const [list, setList] = useState(weekList);

  return (
    // the app's recipe page links its tags; here those links have nowhere to go.
    <MemoryRouter>
      <DemoTimers>
        <Slot id="demo-recipe">
          <RecipeDemo />
        </Slot>
        <Slot id="demo-cook">
          <CookDemo />
        </Slot>
        <Slot id="demo-plan">
          <PlanDemo />
        </Slot>
        <Slot id="demo-shopping">
          <ShoppingDemo items={list} />
        </Slot>
        <Slot id="demo-pantry">
          <PantryDemo
            onAdd={(recipe, missing) =>
              setList((current) =>
                mergeInto(
                  current,
                  recipe.ingredients.filter((item) =>
                    missing.includes(item.name)
                  ),
                  recipe.title
                )
              )
            }
          />
        </Slot>
      </DemoTimers>
    </MemoryRouter>
  );
}

export { Demos };
