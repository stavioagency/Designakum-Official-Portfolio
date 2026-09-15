"use client";

import { useActionState } from "react";
import {
  addItemAction,
  moveItemAction,
  removeItemAction,
  saveItemAction,
} from "@/app/actions/portfolio";
import { ChevronDown, ChevronUp } from "@/components/icons";
import { AddButton, DeleteSubmit, IconSubmit, Status, Submit } from "./ui";

export type CollectionTable = "slides" | "projects" | "stats" | "socials";

/** The words on the buttons around an item, in the reader's language. */
export interface CollectionChrome {
  save: string;
  adding: string;
  remove: string;
  moveUp: string;
  moveDown: string;
}

type Item = { id: string };

function ItemToolbar({
  table,
  portfolioId,
  itemId,
  index,
  total,
  confirmText,
  chrome,
}: {
  table: CollectionTable;
  portfolioId: string;
  itemId: string;
  index: number;
  total: number;
  confirmText: string;
  chrome: CollectionChrome;
}) {
  const [, move] = useActionState(moveItemAction, null);
  const [, remove] = useActionState(removeItemAction, null);

  const hidden = (
    <>
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="itemId" value={itemId} />
    </>
  );

  return (
    <div className="flex items-center gap-1.5">
      {index > 0 && (
        <form action={move}>
          {hidden}
          <input type="hidden" name="direction" value="up" />
          <IconSubmit title={chrome.moveUp}>
            <ChevronUp className="h-4 w-4" />
          </IconSubmit>
        </form>
      )}
      {index < total - 1 && (
        <form action={move}>
          {hidden}
          <input type="hidden" name="direction" value="down" />
          <IconSubmit title={chrome.moveDown}>
            <ChevronDown className="h-4 w-4" />
          </IconSubmit>
        </form>
      )}
      <form action={remove}>
        {hidden}
        <DeleteSubmit confirmText={confirmText} label={chrome.remove} />
      </form>
    </div>
  );
}

function ItemCard({
  table,
  portfolioId,
  item,
  index,
  total,
  title,
  confirmText,
  chrome,
  children,
}: {
  table: CollectionTable;
  portfolioId: string;
  item: Item;
  index: number;
  total: number;
  title: string;
  confirmText: string;
  chrome: CollectionChrome;
  children: React.ReactNode;
}) {
  const [state, save] = useActionState(saveItemAction, null);

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-mist-300">
          <span className="tnum grid h-6 w-6 place-items-center rounded-lg bg-white/[0.07] text-[11px]">
            {index + 1}
          </span>
          {title}
        </p>
        <ItemToolbar
          table={table}
          portfolioId={portfolioId}
          itemId={item.id}
          index={index}
          total={total}
          confirmText={confirmText}
          chrome={chrome}
        />
      </div>

      <form action={save} className="space-y-4">
        <input type="hidden" name="portfolioId" value={portfolioId} />
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="itemId" value={item.id} />
        {children}
        <div className="flex flex-wrap items-center gap-3">
          <Submit className="btn btn-ghost">{chrome.save}</Submit>
          <Status state={state} />
        </div>
      </form>
    </div>
  );
}

export function CollectionSection<T extends Item>({
  table,
  portfolioId,
  items,
  heading,
  description,
  addLabel,
  emptyLabel,
  confirmText,
  itemTitle,
  renderFields,
  chrome,
}: {
  table: CollectionTable;
  portfolioId: string;
  items: T[];
  heading: string;
  description: string;
  addLabel: string;
  emptyLabel: string;
  confirmText: string;
  itemTitle: (item: T, index: number) => string;
  renderFields: (item: T) => React.ReactNode;
  chrome: CollectionChrome;
}) {
  const [addState, add] = useActionState(addItemAction, null);

  return (
    <div className="space-y-4">
      <header className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{heading}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-mist-400">{description}</p>
      </header>

      {items.length === 0 && (
        <p className="panel p-6 text-center text-[13.5px] text-mist-500">{emptyLabel}</p>
      )}

      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          table={table}
          portfolioId={portfolioId}
          item={item}
          index={index}
          total={items.length}
          title={itemTitle(item, index)}
          confirmText={confirmText}
          chrome={chrome}
        >
          {renderFields(item)}
        </ItemCard>
      ))}

      <form action={add}>
        <input type="hidden" name="portfolioId" value={portfolioId} />
        <input type="hidden" name="table" value={table} />
        <AddButton pendingLabel={chrome.adding}>{addLabel}</AddButton>
      </form>
      <Status state={addState} />
    </div>
  );
}
